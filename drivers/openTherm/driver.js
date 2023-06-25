'use strict';

const PlugwiseAdamDriver = require('../../lib/PlugwiseAdamDriver');

module.exports = class PlugwiseAdamOpenThermDriver extends PlugwiseAdamDriver {

  onPairFilterAppliance({ appliance }) {
    if (appliance.type === 'thermostat') return true;
    // if (appliance.type === 'thermostat') return true; Removed since Anna is also supported seprately
    return false;
  }

};
