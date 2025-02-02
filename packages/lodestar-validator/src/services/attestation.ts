/**
 * @module validator/attestation
 */
import {hashTreeRoot} from "@chainsafe/ssz";

import {
  Attestation,
  AttestationData,
  AttestationDataAndCustodyBit,
  BeaconState,
  Fork,
  Shard,
  Slot
} from "@chainsafe/eth2.0-types";
import {IBeaconConfig} from "@chainsafe/eth2.0-config";
import {IApiClient} from "../api";
import {Keypair} from "@chainsafe/bls";
import {IValidatorDB} from "../db/interface";
import {ILogger} from "../logger/interface";
import {computeEpochOfSlot, DomainType, getDomain, isSlashableAttestationData, sleep} from "../util";

export class AttestationService {

  private config: IBeaconConfig;
  private rpcClient: IApiClient;
  private keypair: Keypair;
  private db: IValidatorDB;
  private logger: ILogger;

  public constructor(
    config: IBeaconConfig,
    keypair: Keypair,
    rpcClient: IApiClient,
    db: IValidatorDB,
    logger: ILogger
  ) {
    this.config = config;
    this.rpcClient = rpcClient;
    this.keypair = keypair;
    this.db = db;
    this.logger = logger;
  }


  public async createAndPublishAttestation(
    slot: Slot,
    shard: Shard,
    fork: Fork): Promise<Attestation> {
    await sleep(this.config.params.SECONDS_PER_SLOT * 0.5 * 1000);
    const attestation = await this.rpcClient.validator.produceAttestation(
      this.keypair.publicKey.toBytesCompressed(),
      false,
      slot,
      shard
    );
    if(!attestation) {
      this.logger.warn(`Failed to obtain attestation from beacon node at slot ${slot} and shard ${shard}`);
      return null;
    }
    if (await this.isConflictingAttestation(attestation.data)) {
      this.logger.warn(
        "Avoided signing conflicting attestation! "
        + `Source epoch: ${attestation.data.source.epoch}, Target epoch: ${computeEpochOfSlot(this.config, slot)}`
      );
      return null;
    }
    const attestationDataAndCustodyBit: AttestationDataAndCustodyBit = {
      custodyBit: false,
      data: attestation.data
    };
    attestation.signature = this.keypair.privateKey.signMessage(
      hashTreeRoot(this.config.types.AttestationDataAndCustodyBit, attestationDataAndCustodyBit),
      getDomain(
        this.config,
        {fork} as BeaconState,
        DomainType.ATTESTATION,
        attestation.data.target.epoch,
      )
    ).toBytesCompressed();
    await this.storeAttestation(attestation);
    await this.rpcClient.validator.publishAttestation(attestation);
    this.logger.info(
      `Signed and publish new attestation for block ${attestation.data.target.root.toString("hex")} ` +
      `and shard ${shard} at slot ${slot}`
    );
    return attestation;
  }

  private async isConflictingAttestation(other: AttestationData): Promise<boolean> {
    const potentialAttestationConflicts =
      await this.db.getAttestations(this.keypair.publicKey.toBytesCompressed(), {gt: other.target.epoch - 1});
    return potentialAttestationConflicts.some((attestation => {
      return isSlashableAttestationData(this.config, attestation.data, other);
    }));
  }

  private async storeAttestation(attestation: Attestation): Promise<void> {
    await this.db.setAttestation(this.keypair.publicKey.toBytesCompressed(), attestation);

    //cleanup
    const unusedAttestations =
      await this.db.getAttestations(
        this.keypair.publicKey.toBytesCompressed(),
        {gt: 0, lt: attestation.data.target.epoch}
      );
    await this.db.deleteAttestations(this.keypair.publicKey.toBytesCompressed(), unusedAttestations);
  }
}
