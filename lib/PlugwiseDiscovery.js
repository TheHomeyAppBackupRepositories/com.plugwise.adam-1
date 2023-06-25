'use strict';

const { SimpleClass } = require('homey');
const fetch = require('node-fetch');
// const PlugwiseBridge = require('./PlugwiseBridge');
const PlugwiseAdamBridge = require('./PlugwiseAdamBridge');
const PlugwiseAnnaBridge = require('./PlugwiseAnnaBridge');
const PlugwiseAnnaBridgeLegacy = require('./PlugwiseAnnaBridgeLegacy');
const PlugwiseSmileP1Bridge = require('./PlugwiseSmileP1Bridge');

module.exports = class PlugwiseDiscovery extends SimpleClass {

  static get BRIDGES() {
    return {
      smile_open_therm: PlugwiseAdamBridge,
      smile_thermo: PlugwiseAnnaBridge,
      'smile-thermo': PlugwiseAnnaBridgeLegacy,
      smile: PlugwiseSmileP1Bridge,
    };
  }

  constructor(homey) {
    super();
    this.homey = homey;

    // reset existing bridge data
    // this.homey.settings.set('v2/bridges', {});

    this._bridges = this.homey.settings.get('v2/bridges');
    if (this._bridges) {
      this.log('Recalled bridge data for bridges with IDs', Object.keys(this._bridges));
      for (const [bridgeId, bridgeData] of Object.entries(this._bridges)) {
        const PlugwiseBridge = PlugwiseDiscovery.BRIDGES[bridgeData.product];
        this._bridges[bridgeId] = new PlugwiseBridge(bridgeData);
      }
    } else {
      this._bridges = {};
    }

    this._discoveryStrategy = this.homey.discovery.getStrategy('plugwise');
    this._discoveryStrategy.on('result', discoveryResult => this.onDiscoveryResult(discoveryResult));

    setTimeout(() => {
      Object.values(this._discoveryStrategy.getDiscoveryResults())
        .map(discoveryResult => this.onDiscoveryResult(discoveryResult));
    }, 0);
  }

  async onDiscoveryResult(discoveryResult, addEventHandlers = true) {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    if (addEventHandlers) {
      discoveryResult.on('addressChanged', discoveryResult => {
        this.log('discoveryResult addressChanged for', discoveryResult.name);
        return this.onDiscoveryResult(discoveryResult, false);
      });

      discoveryResult.on('lastSeenChanged', discoveryResult => {
        this.log('discoveryResult lastSeenChanged for', discoveryResult.name);
        return this.onDiscoveryResult(discoveryResult, false);
      });

      discoveryResult.on('discoveryAvailable', discoveryResult => {
        this.log('discoveryResult discoveryAvailable for', discoveryResult.name);
        return this.onDiscoveryResult(discoveryResult, false);
      });
    }

    const bridgeName = discoveryResult.name;
    const bridgeAddress = discoveryResult.address;
    const bridgeVersion = discoveryResult.txt.version;
    const bridgeProduct = discoveryResult.txt.product;
    const bridgeId = discoveryResult.id
      .replace('Plugwise on smile', '');

    this.log(`[Bridge ${bridgeId}] onDiscoveryResult received for bridge (IP ${bridgeAddress})`);
    this.log(`[Bridge ${bridgeId}] discoveryResult`, discoveryResult);

    // wait for 20 seconds after mDNS-DS broadcast to check if bridge is up and running
    await delay(20000);

    fetch(`http://${bridgeAddress}`).then(res => {
      const server = res.headers.get('server');

      if (!server || !server.toLowerCase().includes('plugwise')) return;

      if (this._bridges[bridgeId]) {
        if (this._bridges[bridgeId].address !== bridgeAddress) {
          this.log(`[Bridge ${bridgeId}] Changed address from ${this._bridges[bridgeId].address} to ${bridgeAddress}`);
          this._bridges[bridgeId].address = bridgeAddress;
        }

        if (this._bridges[bridgeId].version !== bridgeVersion) {
          this.log(`[Bridge ${bridgeId}] Changed version from ${this._bridges[bridgeId].version} to ${bridgeVersion}`);
          this._bridges[bridgeId].version = bridgeVersion;
        }
        this.log(`[Bridge ${bridgeId}] Stored updated bridge data (IP: ${bridgeAddress})`);
        this.homey.settings.set('v2/bridges', this._bridges);
        this.emit('bridge', this._bridges[bridgeId]);
        this.emit(`bridge:${bridgeId}`, this._bridges[bridgeId]);
      } else {
        const PlugwiseBridge = this.constructor.BRIDGES[bridgeProduct];
        if (!PlugwiseBridge) {
          throw new Error(`Unspported product: ${bridgeProduct}`);
        }

        const bridge = new PlugwiseBridge({
          id: bridgeId,
          address: bridgeAddress,
          version: bridgeVersion,
          name: bridgeName,
          product: bridgeProduct,
        });
        this._bridges[bridgeId] = bridge;
        this.log(`[Bridge ${bridgeId}] Stored new bridge data (IP: ${bridgeAddress})`);

        this.homey.settings.set('v2/bridges', this._bridges);

        this.emit('bridge', bridge);
        this.emit(`bridge:${bridge.id}`, bridge);
        this.log('Found bridge', bridge.constructor.name, bridge.product, bridge.id, bridge.version, bridge.address);
      }
    }).catch(this.error);
  }

  get bridges() {
    return this._bridges;
  }

};
