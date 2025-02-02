import {assert} from "chai";
import {promisify} from "es6-promisify";
// @ts-ignore
import PeerInfo from "peer-info";
import {NodejsNode} from "../../../../src/network/nodejs";
import {createNode} from "../util";

const multiaddr = "/ip4/127.0.0.1/tcp/0";

describe("[network] nodejs libp2p", () => {
  it("can start and stop a node", async () => {
    const node: NodejsNode = await createNode(multiaddr);
    await promisify(node.start.bind(node))();
    assert.equal(node.isStarted(), true);
    await promisify(node.stop.bind(node))();
    assert.equal(node.isStarted(), false);
  });
  it("can connect/disconnect to a peer", async function ()  {
    this.timeout(5000)
    // setup
    const nodeA: NodejsNode = await createNode(multiaddr);
    const nodeB: NodejsNode = await createNode(multiaddr);

    await Promise.all([
      promisify(nodeA.start.bind(nodeA))(),
      promisify(nodeB.start.bind(nodeB))(),
    ]);

    // connect
    await promisify<void, PeerInfo>(nodeA.dial.bind(nodeA))(nodeB.peerInfo);
    await new Promise((resolve, reject) => {
      const t = setTimeout(reject, 1000);
      nodeB.once("peer:connect", () => {
        clearTimeout(t);
        resolve();
      });
    });


    // test connection
    assert(nodeA.peerBook.get(nodeB.peerInfo).isConnected());
    assert(nodeB.peerBook.get(nodeA.peerInfo).isConnected());

    // disconnect
    const p = new Promise(resolve => nodeB.once("peer:disconnect", resolve));
    await new Promise(resolve => setTimeout(resolve, 100));
    await promisify<void, PeerInfo>(nodeA.hangUp.bind(nodeA))(nodeB.peerInfo);
    await p

    // test disconnection
    assert(!nodeA.peerBook.get(nodeB.peerInfo).isConnected());
    assert(!nodeB.peerBook.get(nodeA.peerInfo).isConnected());
    // teardown
    await Promise.all([
      promisify(nodeA.stop.bind(nodeA))(),
      promisify(nodeB.stop.bind(nodeB))(),
    ]);
  });
});
