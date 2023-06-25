'use strict';

const Homey = require('homey');
const semver = require('semver');

const PlugwiseDevice = require('../../lib/PlugwiseDevice');

module.exports = class PlugwiseSmileP1Device extends PlugwiseDevice {

  async onInit(...props) {
    await super.onInit(...props);

    // enable debugging
    // this.enableDebug();

    if (!this.hasCapability('meter_gas')) {
      this.addCapability('meter_gas').catch(this.error);
    }

    await this.migrateCapabilities();
  }

  onPoll({ payload }) {
    // console.log(JSON.stringify(payload, false, 2));
    if (!payload) return;
    const { location } = payload;
    const { logs } = location;
    if (!logs) return;

    /* eslint-disable */
    const capabilitiesArray = {
      'measure_power': [
          { logType: 'electricity_consumed',              logUnit: 'W', sign:  1,},
          { logType: 'electricity_produced',              logUnit: 'W', sign: -1,},
      ],
      'measure_power.phase1': [
          { logType: 'electricity_phase_one_consumed',    logUnit: 'W', sign:  1,},
          { logType: 'electricity_phase_one_produced',    logUnit: 'W', sign: -1,},
      ],
      'measure_power.phase2': [
          { logType: 'electricity_phase_two_consumed',    logUnit: 'W', sign:  1,},
          { logType: 'electricity_phase_two_produced',    logUnit: 'W', sign: -1,},
      ],
      'measure_power.phase3': [
          { logType: 'electricity_phase_three_consumed',  logUnit: 'W', sign:  1,},
          { logType: 'electricity_phase_three_produced',  logUnit: 'W', sign: -1,},
      ],
      'measure_voltage.phase1':[
          { logType: 'voltage_phase_one',                 logUnit: 'V', sign:  1,},
      ],
      'measure_voltage.phase2': [
          { logType: 'voltage_phase_two',                 logUnit: 'V', sign:  1,},
      ],
      'measure_voltage.phase3': [
          { logType: 'voltage_phase_three',               logUnit: 'V', sign:  1,},
      ],
    };
    /* eslint-enable */

    Object.keys(capabilitiesArray).forEach(_capability => {
      let parsedValue = 0;

      Object.keys(capabilitiesArray[_capability]).forEach(id => {
        const _subCapability = capabilitiesArray[_capability][id];
        if (Array.isArray(logs.point_log)) {
          const log = logs.point_log.filter(log => {
            if (log.type === _subCapability.logType
              && log.unit === _subCapability.logUnit
              && log.period
              && log.period.measurement) return true;
            return false;
          }).pop();
          if (log) {
            const value = Array.isArray(log.period.measurement)
              ? log.period.measurement.reduce((total, item) => {
                return total + parseFloat(item.$text);
              }, 0)
              : parseFloat(log.period.measurement.$text);
            if (value >= 0) {
              // if (_capability.includes('measure_power')) this.debug(_capability, '|', _subCapability.logType, _subCapability.sign * value);
              parsedValue += _subCapability.sign * value;
            }
          }
        }
      });
      // If the Capability exists, log debug and update value;
      if (this.hasCapability(_capability)) {
        let _debug = '';
        if (_capability.includes('measure_power')) _debug = (parsedValue >= 0) ? '| consumed' : '| produced';
        this.debug(_capability, _debug, parsedValue);
        this.setCapabilityValue(_capability, parsedValue).catch(this.error);
      }
    });

    // meter_gas
    if (Array.isArray(logs.cumulative_log)) {
      const log = logs.cumulative_log.filter(log => {
        if (log.type === 'gas_consumed'
          && log.unit === 'm3'
          && log.period
          && log.period.measurement) return true;
        return false;
      }).pop();

      if (log) {
        const value = Array.isArray(log.period.measurement)
          ? log.period.measurement.reduce((total, item) => {
            return total + parseFloat(item.$text);
          }, 0)
          : parseFloat(log.period.measurement.$text);
        this.debug('meter_gas', value);
        this.setCapabilityValue('meter_gas', value).catch(this.error);
      }
    }

    // meter_power
    if (Array.isArray(logs.cumulative_log)) {
      const cumLogs = logs.cumulative_log.filter(log => {
        if ((log.type === 'electricity_consumed' || log.type === 'electricity_produced')
          && log.unit === 'Wh'
          && log.period
          && log.period.measurement) return true;
        return false;
      });

      let netValue = 0;
      cumLogs.forEach(log => {
        let values = {};
        if (Array.isArray(log.period.measurement)) {
          values = log.period.measurement.reduce((a, d) => {
            a[d.$attr.tariff] = parseFloat(d.$text / 1000); return a;
          }, {});
          values.total = log.period.measurement.reduce((total, item) => {
            return total + parseFloat(item.$text) / 1000;
          }, 0);
        } else {
          values.total = parseFloat(log.period.measurement.$text) / 1000;
        }

        if (log.type === 'electricity_consumed') {
          this.debug('meter_power.consumed', values);
          if (this.hasCapability('meter_power.consumed')) this.setCapabilityValue('meter_power.consumed', values.total).catch(this.error);
          if (this.hasCapability('meter_power.consumedPeak') && values.hasOwnProperty('nl_peak')) this.setCapabilityValue('meter_power.consumedPeak', values.nl_peak).catch(this.error);
          if (this.hasCapability('meter_power.consumedOffPeak') && values.hasOwnProperty('nl_offpeak')) this.setCapabilityValue('meter_power.consumedOffPeak', values.nl_offpeak).catch(this.error);
          netValue += values.total;
        }

        if (log.type === 'electricity_produced') {
          this.debug('meter_power.produced', values);
          if (this.hasCapability('meter_power.produced')) this.setCapabilityValue('meter_power.produced', values.total).catch(this.error);
          if (this.hasCapability('meter_power.producedPeak') && values.hasOwnProperty('nl_peak')) this.setCapabilityValue('meter_power.producedPeak', values.nl_peak).catch(this.error);
          if (this.hasCapability('meter_power.producedOffPeak') && values.hasOwnProperty('nl_offpeak')) this.setCapabilityValue('meter_power.producedOffPeak', values.nl_offpeak).catch(this.error);
          netValue += -values.total;
        }
      });
      this.debug('meter_power NETTO', netValue);
      this.setCapabilityValue('meter_power', netValue).catch(this.error);
    }
  }

  async checkThreePhaseValuesExist(locations, unit) {
    if (locations.logs.point_log) {
      let _phaseValue = 0;
      Object.keys(locations.logs.point_log).forEach(id => {
        const log = locations.logs.point_log[id];
        if (log.unit === unit
            && log.type.includes('_phase_')
            && log.period
            && log.period.measurement) {
          const value = Array.isArray(log.period.measurement)
            ? log.period.measurement.reduce((total, item) => {
              return total + parseFloat(item.$text);
            }, 0)
            : parseFloat(log.period.measurement.$text);
          if (value >= 0) _phaseValue += value;
        }
      });
      return _phaseValue > 0;
    }
    return false;
  }

  async getDSMRVersion(modules) {
    let DSMRVersion = 0;
    const module = modules.filter(module => {
      if (module.protocols.hasOwnProperty('dsmr_main')) return true;
      return false;
    }).pop();
    if (module) {
    // this.log('module (popped)', module);
      DSMRVersion = module.protocols.dsmr_main.version / 10;
      this.debug('DSMRVersion', DSMRVersion);
    }
    return DSMRVersion;
  }

  // async migrateCapabilities() {
  async migrateCapabilities() {
    const gateway = await this.bridge.getGateway();
    const locations = await this.bridge.getLocations();
    const modules = await this.bridge.getModules();

    if (gateway && locations) {
      // Update generic capabilities
      if (!this.hasCapability('meter_power')) await this.addCapability('meter_power').catch(this.error);
      if (!this.hasCapability('meter_gas')) await this.addCapability('meter_gas').catch(this.error);
      if (!this.hasCapability('meter_power.produced')) await this.addCapability('meter_power.produced').catch(this.error);
      if (!this.hasCapability('meter_power.consumed')) await this.addCapability('meter_power.consumed').catch(this.error);

      // Upgrade capabilities based on tariff structure
      const electricityProductionTariffStructure = gateway.gateway_environment.electricity_production_tariff_structure;
      if (this.getStoreValue('electricityProductionTariffStructure') !== electricityProductionTariffStructure) {
        if (electricityProductionTariffStructure === 'double') {
          // Update / add capabilities based on double tarriff structure if missing
          if (!this.hasCapability('meter_power.consumedPeak')) await this.addCapability('meter_power.consumedPeak').catch(this.error);
          if (!this.hasCapability('meter_power.consumedOffPeak')) await this.addCapability('meter_power.consumedOffPeak').catch(this.error);
          if (!this.hasCapability('meter_power.producedPeak')) await this.addCapability('meter_power.producedPeak').catch(this.error);
          if (!this.hasCapability('meter_power.producedOffPeak')) await this.addCapability('meter_power.producedOffPeak').catch(this.error);
          await this.setStoreValue('electricityProductionTariffStructure', electricityProductionTariffStructure).catch(this.error);
        } else {
          // Update / remove capabilities based on single tarriff structure if available
          if (this.hasCapability('meter_power.consumedPeak')) await this.removeCapability('meter_power.consumedPeak').catch(this.error);
          if (this.hasCapability('meter_power.consumedOffPeak')) await this.removeCapability('meter_power.consumedOffPeak').catch(this.error);

          if (this.hasCapability('meter_power.producedPeak')) await this.removeCapability('meter_power.producedPeak').catch(this.error);
          if (this.hasCapability('meter_power.producedOffPeak')) await this.removeCapability('meter_power.producedOffPeak').catch(this.error);
          await this.setStoreValue('electricityProductionTariffStructure', 'single').catch(this.error);
        }
        this.log('Completed migration of tariff capabilities based on', electricityProductionTariffStructure, 'tarriff');
      }

      // Upgrade capabilities based on meter type (one of three phase)

      const DSMRVersion = await this.getDSMRVersion(modules);
      // If bridge FW version >= 4.4, DSMR meter version >= 4 and actual measurement data is present, add missing POWER capabilities
      const threePhasePowerCapable = (semver.gt(this.bridge._version, '4.4.0') && DSMRVersion >= 4 && await this.checkThreePhaseValuesExist(locations, 'W'));
      if (!this.hasCapability('measure_power.phase1') && threePhasePowerCapable) {
        if (!this.hasCapability('measure_power.phase1')) await this.addCapability('measure_power.phase1').catch(this.error);
        if (!this.hasCapability('measure_power.phase2')) await this.addCapability('measure_power.phase2').catch(this.error);
        if (!this.hasCapability('measure_power.phase3')) await this.addCapability('measure_power.phase3').catch(this.error);
        this.log('Completed migration of THREE phase MEASURE_POWER capabilities, bridge version > 4.4.0:', semver.gt(this.bridge._version, '4.4.0'), 'DSMR version >= 4:', DSMRVersion >= 4);
      }

      // If bridge FW version >= 4.4, DSMR meter version >= 5 and actual measurement data is present, add missing VOLTAGE capabilities
      const threePhaseVoltageCapable = (semver.gt(this.bridge._version, '4.4.0') && DSMRVersion >= 5 && await this.checkThreePhaseValuesExist(locations, 'V'));
      if (!this.hasCapability('measure_voltage.phase1') && threePhaseVoltageCapable) {
        if (!this.hasCapability('measure_voltage.phase1')) await this.addCapability('measure_voltage.phase1').catch(this.error);
        if (!this.hasCapability('measure_voltage.phase2')) await this.addCapability('measure_voltage.phase2').catch(this.error);
        if (!this.hasCapability('measure_voltage.phase3')) await this.addCapability('measure_voltage.phase3').catch(this.error);
        this.log('Completed migration of THREE phase MEASURE_VOLTAGE capabilities, bridge version > 4.4.0:', semver.gt(this.bridge._version, '4.4.0'), 'DSMR version >= 5:', DSMRVersion >= 5);
      }
      return this.log('Smile P1 meter (DSMR version', DSMRVersion, ') capabilities based on', electricityProductionTariffStructure.toUpperCase(), 'tarriff with', threePhasePowerCapable ? 'THREE' : 'ONE', 'phase power meter', threePhaseVoltageCapable ? 'and THREE phase voltage meter' : '');
    }
  }

};
