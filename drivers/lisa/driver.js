'use strict';

const PlugwiseAdamDriver = require('../../lib/PlugwiseAdamDriver');

module.exports = class PlugwiseAdamLisaDriver extends PlugwiseAdamDriver {

  onPairFilterAppliance({ appliance }) {
    if (appliance.type === 'zone_thermostat') return true;
    // if (appliance.type === 'thermostat') return true; Removed since Anna is also supported seprately
    return false;
  }

};
