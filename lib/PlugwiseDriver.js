'use strict';

const Homey = require('homey');

module.exports = class PlugwiseDriver extends Homey.Driver {

  static get BRIDGE_PRODUCTS() {
    return [];
  }

  async onPair(session) {
    let bridge;
    let bridges;
    let password;

    const onListDevicesBridges = async data => {
      bridges = await this.homey.app.getBridges();
      const devices = Object.values(bridges).filter(bridge => {
        return this.constructor.BRIDGE_PRODUCTS.includes(bridge.product);
      }).map(bridge => {
        return {
          name: bridge.name,
          data: {
            id: bridge.id,
          },
        };
      });
      return devices;
    };

    const onListDevicesDevices = async data => {
      if (!bridge) {
        return new Error('Missing Bridge');
      }

      return this.onPairListDevices({ bridge })
        .then(devices => {
          return devices;
        });
    };

    const onListDevices = data => {
      if (bridge) return onListDevicesDevices(data);
      return onListDevicesBridges(data);
    };

    const onListBridgesSelection = async data => {
      const [device] = data;
      const { id } = device.data;

      bridge = bridges[id];
    };

    const onPincode = async pincode => {
      if (!bridge) {
        throw Error('Missing Bridge');
      }

      password = pincode.join('');

      return bridge.testPassword({ password })
        .then(result => {
          if (result === true) {
            bridge.password = password;
          }

          return result;
        });
    };

    const onShowView = async viewId => {
      if (viewId === 'loading') {
        if (bridge && bridge.password) {
          session.showView('list_devices');
        } else {
          session.showView('pincode');
        }
      }
    };

    session.setHandler('showView', onShowView);
    session.setHandler('list_devices', onListDevices);
    session.setHandler('list_bridges_selection', onListBridgesSelection);
    session.setHandler('pincode', onPincode);
  }

  async onPairListDevices({ bridge }) {
    const appliances = await bridge.getAppliances();
    return [].concat(appliances).filter(appliance => {
      if (!appliance) return false;
      this.log(`Appliance Name:${appliance.name} Type:${appliance.type}`);
      return this.onPairFilterAppliance({ appliance, bridge });
    }).map(appliance => {
      return {
        name: appliance.name,
        data: {
          bridgeId: bridge.id,
          applianceId: appliance.$attr.id,
        },
        store: {
          password: bridge.password,
        },
      };
    });
  }

  onPairFilterAppliance({ appliance }) {
    return false;
  }

};
