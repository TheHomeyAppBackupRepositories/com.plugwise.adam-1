'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const PlugwiseDiscovery = require('./PlugwiseDiscovery');

module.exports = class PlugwiseApp extends Homey.App {

  async onInit() {
    this.discovery = await new PlugwiseDiscovery(this.homey);
    this.discovery.on('__log', (...args) => this.log('[PlugwiseDiscovery]', ...args));
    this.discovery.on('__error', (...args) => this.error('[PlugwiseDiscovery]', ...args));
  }

  async getBridges() {
    this.log('Retrieving data for bridges:', Object.keys(this.discovery.bridges));
    return this.discovery.bridges;
  }

  async getBridge({ bridgeId }) {
    if (this.discovery.bridges[bridgeId]) {
      const bridge = this.discovery.bridges[bridgeId];
      try {
        const res = await fetch(`http://${bridge.address}`);
        this.log(`[Bridge ${bridgeId}] Init bridge based on previously stored data (IP ${bridge.address})`);
        return bridge;
      } catch (e) {
        this.log(`[Bridge ${bridgeId}] Unable to init bridge based on previously stored data. Address ${bridge.address} not responding`);
      }
    }
    this.log(`[Bridge ${bridgeId}] Init bridge is waiting on mDNS discovery result`);
    return new Promise(resolve => {
      return this.discovery.once(`bridge:${bridgeId}`, resolve);
    });
  }

};
