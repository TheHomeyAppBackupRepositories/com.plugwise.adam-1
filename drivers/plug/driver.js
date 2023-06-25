'use strict';

const PlugwiseAdamDriver = require('../../lib/PlugwiseAdamDriver');

module.exports = class PlugwiseAdamPlugDriver extends PlugwiseAdamDriver {

  onPairFilterAppliance({ appliance }) {
    if (appliance.type === 'amplifier') return true;
    if (appliance.type === 'central_heating_pump') return true;
    if (appliance.type === 'charger') return true;
    if (appliance.type === 'coffee_maker') return true;
    if (appliance.type === 'computer_desktop') return true;
    if (appliance.type === 'computer_notebook') return true;
    if (appliance.type === 'cooler_water') return true;
    if (appliance.type === 'cooling_contact') return true;
    if (appliance.type === 'deepfryer') return true;
    if (appliance.type === 'dishwasher') return true;
    if (appliance.type === 'dryer') return true;
    if (appliance.type === 'electricfan') return true;
    if (appliance.type === 'fax') return true;
    if (appliance.type === 'foodprocessor') return true;
    if (appliance.type === 'freezer') return true;
    if (appliance.type === 'game_console') return true;
    if (appliance.type === 'heater_electric') return true;
    if (appliance.type === 'hometheater') return true;
    if (appliance.type === 'lamp') return true;
    if (appliance.type === 'lighting') return true;
    if (appliance.type === 'machine_vending') return true;
    if (appliance.type === 'monitor') return true;
    if (appliance.type === 'multifunctional') return true;
    if (appliance.type === 'oven') return true;
    if (appliance.type === 'oven_microwave') return true;
    if (appliance.type === 'player_disc') return true;
    if (appliance.type === 'printer') return true;
    if (appliance.type === 'projector') return true;
    if (appliance.type === 'pump_heater') return true;
    if (appliance.type === 'pwcentral') return true;
    if (appliance.type === 'radio') return true;
    if (appliance.type === 'refrigerator') return true;
    if (appliance.type === 'router') return true;
    if (appliance.type === 'satelitedish') return true;
    if (appliance.type === 'scanner_pc') return true;
    if (appliance.type === 'settop') return true;
    if (appliance.type === 'solarpanel') return true;
    if (appliance.type === 'speakers') return true;
    if (appliance.type === 'tanningbed') return true;
    if (appliance.type === 'telephone') return true;
    if (appliance.type === 'toaster') return true;
    if (appliance.type === 'turbine_wind') return true;
    if (appliance.type === 'tv') return true;
    if (appliance.type === 'ventilation') return true;
    if (appliance.type === 'vcr') return true;
    if (appliance.type === 'washingmachine') return true;
    if (appliance.type === 'water_bed') return true;
    if (appliance.type === 'water_heater_vessel') return true;
    if (appliance.type === 'watercooker') return true;
    if (appliance.type === 'zz_misc') return true;
    if (appliance.type === 'valve_actuator') return true;
    return false;
  }

};
