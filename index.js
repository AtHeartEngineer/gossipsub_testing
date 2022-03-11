import Libp2p from "libp2p";
import WebSockets from "libp2p-websockets";
import TCP from "libp2p-tcp"
import { NOISE } from "libp2p-noise"
import { Mplex } from "libp2p-mplex";
import Gossipsub from "libp2p-gossipsub"
import { multiaddr } from "multiaddr";
import Peers from "./fixtured_peers.js"
import PeerId from 'peer-id'

/*
   Setup libp2p Node
*/

let topic = "test"
let node_options = {
    addresses: {
        listen: ['/ip4/0.0.0.0/tcp/0']
    },
    modules: {
        transport: [TCP],
        connEncryption: [NOISE],
        streamMuxer: [Mplex],
        pubsub: Gossipsub
    }
}

// stolen from js_libp2p_gossipsub testing
function getListenAddress (peerId) {
    return new multiaddr('/ip4/127.0.0.1/tcp/0/ws')
  }

// stolen from js_libp2p_gossipsub testing
async function createPeer ({ peerId, started = true, config = {} } = {}) {
    if (!peerId) {
      peerId = await PeerId.createFromJSON(Peers[0])
    }
    const libp2p = await Libp2p.create({
      peerId: peerId,
      addresses: {
        listen: [getListenAddress(peerId)]
      },
      ...config
    })

    if (started) {
      await libp2p.start()
    }

    return libp2p
  }
// stolen from js_libp2p_gossipsub testing
  async function createPeers ({ number = 1, started = true, seedAddressBook = true, config = {} } = {}) {
    const peerIds = await Promise.all(
      Array.from({ length: number }, (_, i) => Peers[i] ? PeerId.createFromJSON(Peers[i]) : PeerId.create())
    )
    const peers = await Promise.all(
      Array.from({ length: number }, (_, i) => createPeer({ peerId: peerIds[i], started: false, config: config }))
    )

    if (started) {
      await Promise.all(
        peers.map((p) => p.start())
      )

      if (seedAddressBook) {
        addPeersToAddressBook(peers)
      }
    }

    return peers
  }

async function bootstrapPeerNodes(_number, _node_options) {
    let peers = await createPeers({number: _number, started: false, config: _node_options})
    peers.forEach((peer) => {
        // Console log discovery of a new peer
        peer.on('peer:discovery', (peer) => {
            console.log('Discovered %s', peer)
        })

        // Console log peer connections
        peer.connectionManager.on('peer:connect', (connection) => {
            console.log('Connected to %s', connection.remotePeer.toB58String())
        })

        // Console log incoming messages
        peer.pubsub.on(topic, (msg) => {
            console.log(`peer received: ${msg.data}`)
        })

        // Start the peer node
        peer.start()

        // print out PeerId
        console.log(`Started Peer ${peer.peerId.toB58String()}`)

        // print out listening addresses
        console.log('listening on addresses:')
        peer.multiaddrs.forEach(addr => {
            console.log(`    ${addr.toString()}/p2p/${peer.peerId.toB58String()}`)
        })
    })
    //console.log(peers.length)
    return peers
}

const peers = await bootstrapPeerNodes(3, node_options)

const stop = async () => {
    // stop libp2p
    (await peers).forEach((peer) => {
        peer.stop()
    })
    console.log('libp2p has stopped')
    process.exit(0)
}

process.on('SIGTERM', stop)
process.on('SIGINT', stop)

/*
   EXPERIMENTATION TIME!!!!!
*/
//console.log(peers[0])
await new Promise(r => setTimeout(r, 1000));

// ping peer if received multiaddr
if (process.argv.length >= 3) {
    const ma = multiaddr(process.argv[2])
    console.log(`pinging remote peer at ${process.argv[2]}`)
    const latency = await peers[0].ping(ma)
    console.log(`pinged ${process.argv[2]} in ${latency}ms`)
    await peers[0].pubsub.subscribe(topic)

    await peers[0].pubsub.publish(topic, 'asdf')
} else {
    console.log('no remote peer address given, skipping ping')
}




