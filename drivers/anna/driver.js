'use strict';

const Homey = require('homey');
const PlugwiseAnnaDriver = require('../../lib/PlugwiseAnnaDriver');

module.exports = class extends PlugwiseAnnaDriver {

  async onInit() {
    await super.onInit();

    this.homey.flow
      .getActionCard('set_preset')
      .registerRunListener(async ({ device, preset }) => {
        return device.setPreset(preset);
      });
  }

  onPairFilterAppliance({ appliance }) {
    if (appliance.type === 'zone_thermostat') return true;
    if (appliance.type === 'thermostat') return true;
    return false;
  }

};
