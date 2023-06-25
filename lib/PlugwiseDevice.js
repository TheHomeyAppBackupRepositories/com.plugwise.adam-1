'use strict';

const Homey = require('homey');
const semver = require('semver');

module.exports = class PlugwiseDevice extends Homey.Device {

  async onInit(...props) {
    await super.onInit(...props);

    this._debugEnabled = false;

    this._onPoll = this._onPoll.bind(this);
    this._onAppliancePoll = this._onAppliancePoll.bind(this);
    this._onLocationPoll = this._onLocationPoll.bind(this);

    const {
      bridgeId,
      applianceId,
      locationId,
    } = this.getData();

    this.bridgeId = bridgeId.replace(/-.*/, ''); // remove trailing -2 and -3's as result of mDNS collissions
    this.applianceId = applianceId || null;
    this.locationId = locationId || null;

    const {
      password,
    } = this.getStore();

    this.setUnavailable(this.homey.__('loading')).catch(this.error);

    await this.homey.app.getBridge({ bridgeId })
      .then(bridge => {
        this.bridge = bridge;
        return this.bridge.testPassword({ password });
      })
      .then(result => {
        if (!result) {
          throw new Error('Invalid password');
        }
        this.bridge.password = password;
        this.bridge.enablePolling(this.homey);
        this.bridge.on('poll', this._onPoll);

        if (this.applianceId) {
          this.bridge.on(`appliance:${applianceId}:poll`, this._onAppliancePoll);
        }

        if (this.locationId) {
          this.bridge.on(`location:${locationId}:poll`, this._onLocationPoll);
        }

        this.setAvailable().catch(this.error);
      })
      .catch(err => {
        this.error(err);
        this.setUnavailable(err).catch(this.error);
      });
  }

  _onPoll(payload) {
    try {
      this.onPoll({ payload });
    } catch (err) {
      this.error(err);
    }
  }

  _onAppliancePoll(appliance) {
    try {
      this.onPoll({ appliance });
    } catch (err) {
      this.error(err);
    }
  }

  _onLocationPoll(location) {
    try {
      this.onPoll({ location });
    } catch (err) {
      this.error(err);
    }
  }

  onPoll() {
    // Extend me
  }

  onDeleted() {
    if (this.bridge) {
      this.log('removing device linked to bridgeId', this.bridgeId);
      this.bridge.stopPolling(this.homey);

      if (this.applianceId) {
        this.log(`removing listener: appliance:${this.applianceId}:poll`);
        this.bridge.removeListener(`appliance:${this.applianceId}:poll`, this._onAppliancePoll);
      }

      if (this.locationId) {
        this.log(`removing listener: location:${this.locationId}:poll`);
        this.bridge.removeListener(`location:${this.locationId}:poll`, this._onLocationPoll);
      }

      if (this._onPoll) {
        this.log('removing listener: poll: _onPoll');
        this.bridge.removeListener('poll', this._onPoll);
      }
    }
  }

  /**
   * Debug logging method. Will only log to stdout if enabled via {@link enableDebug}.
   * @param {*} args
   */
  debug(...args) {
    if (this._debugEnabled) {
      this.log.bind(this, '[dbg]').apply(this, args);
    }
  }

  /**
   * Enable {@link ZigBeeDevice.debug} statements.
   */
  enableDebug() {
    this._debugEnabled = true;

    // Attach unhandled promise rejection handler
    process.on('unhandledRejection', error => {
      this.error('unhandledRejection', error);
    });
  }

};
