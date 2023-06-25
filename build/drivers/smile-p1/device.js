'use strict';

const Homey = require('homey');

const PlugwiseDevice = require('../../lib/PlugwiseDevice');

module.exports = class PlugwiseSmileP1Device extends PlugwiseDevice {

  async onInit(...props) {
    await super.onInit(...props);

    // enable debugging
    this.enableDebug();

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

    // measure_power
    if (Array.isArray(logs.point_log)) {
      const log = logs.point_log.filter(log => {
        if (log.type === 'electricity_consumed'
          && log.unit === 'W'
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
        if (value > 0) {
          this.debug('measure_power | consumed', value);
          this.setCapabilityValue('measure_power', value).catch(this.error);
        }
      }
    }

    if (Array.isArray(logs.point_log)) {
      const log = logs.point_log.filter(log => {
        if (log.type === 'electricity_produced'
          && log.unit === 'W'
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
        if (value > 0) {
          this.debug('measure_power | produced', -value);
          this.setCapabilityValue('measure_power', -value).catch(this.error);
        }
      }
    }

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

  // async migrateCapabilities() {
  async migrateCapabilities() {
    const gateway = await this.bridge.getGateway();
    if (gateway) {
      const electricityProductionTariffStructure = gateway.gateway_environment.electricity_production_tariff_structure;

      // Update generic capabilities
      if (!this.hasCapability('meter_power')) await this.addCapability('meter_power').catch(this.error);
      if (!this.hasCapability('meter_gas')) await this.addCapability('meter_gas').catch(this.error);
      if (!this.hasCapability('meter_power.produced')) await this.addCapability('meter_power.produced').catch(this.error);
      if (!this.hasCapability('meter_power.consumed')) await this.addCapability('meter_power.consumed').catch(this.error);

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
        // await this.setStoreValue('migrationComplete', true).catch(this.error);
        return this.log('Completed migration capabilities based on', electricityProductionTariffStructure, 'tarriff');
      }
      return this.log('Smile P1 meter capabilities based on', electricityProductionTariffStructure, 'tarriff');
    }
  }

};
