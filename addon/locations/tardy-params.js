import HistoryLocation from '@ember/routing/history-location';
import EmberObject, { computed, getProperties } from '@ember/object';
import { alias } from '@ember/object/computed';
import toParamString from 'jquery-param';

const parseParams = function(str) {
  if (!str) return {};
  return str.split('&').reduce(function (params, param) {
    const mutatedParams = params;
    const paramSplit = param.split('=').map(function (value) {
      return decodeURIComponent(value.replace(/\+/g, ' '));
    });

    if (paramSplit.length < 2) return params;
    paramSplit[1] = JSON.parse(paramSplit[1]);

    [, mutatedParams[paramSplit[0]]] = paramSplit;
    return mutatedParams;
  }, {});
};

export default class TardyParamsLocation extends HistoryLocation {
  // public
  // hash of params, current state
  current = {}

  // object map for aliases
  _aliasMap = null

  // oneWay cache of default state
  // protected
  defaultProperties = null

  // is setup done?
  isReady = false

  // called once
  setupQueryParamModels(expected, received, modelKey = 'visible') {
    // map and alias model prop references to public properties
    const aliasedObjectMap = expected
      .reduce((acc, layerGroup) => {
        const id = layerGroup.get('id');
        acc[`_${id}`] = layerGroup;
        acc[id] = alias(`_${id}.${modelKey}`);

        return acc;
      }, {});
    const keys = expected.mapBy('id');
    const _aliasMap = EmberObject.extend(aliasedObjectMap).create();

    // coerce types. later: coerce to inferred types
    const coercedReceivedParams = {};
    Object.keys(received).forEach((key) => {
      if (keys.includes(key)) {
        coercedReceivedParams[key] = JSON.parse(received[key]);
      }
    });

    // cache the original values
    this.set('defaultProperties', _aliasMap.getProperties(...keys));

    // update the new alias map with received types
    _aliasMap.setProperties(coercedReceivedParams);

    keys.forEach((key) => {
      _aliasMap.addObserver(`${key}`, this, 'pushSpecialParamState');
    });

    this.setProperties({
      keys,
      _aliasMap,

      // current: object of what is not the default
      current: computed(...keys.map(key => `_aliasMap.${key}`), function() {
        const allProperties = this.get('_aliasMap').getProperties(...keys);
        const defaultProperties = this.get('defaultProperties');

        return keys.reduce((acc, key) => {
          if (allProperties[key] !== defaultProperties[key]) {
            acc[key] = allProperties[key];
          }

          return acc;
        }, {});
      }),
      isReady: true,
    });
  }

  // this is triggered by observer and decides what / if push to URL state
  pushSpecialParamState() {
    let newPath = this.get('location').pathname || '/';

    // object is representation of diff from defaults
    const currentSpecialParams = this.get('current');
    const { search: queryParams = '' } = this.get('location');

    // let non-special params in
    const parsedQueryParams = parseParams(queryParams.replace('?', ''));
    const regularParams =
      Object.keys(parsedQueryParams).reject(key => this.get('keys').includes(key));
    const regularParamString = toParamString(getProperties(parsedQueryParams, ...regularParams));

    // param string of special params
    const specialParamsString = toParamString(currentSpecialParams);

    // is there something to add?
    if (specialParamsString) {
      newPath += `?${specialParamsString}`;
    }

    if (regularParamString) {
      if (specialParamsString) {
        newPath += `&${regularParamString}`;
      } else {
        newPath += `?${regularParamString}`;
      }
    }

    this.pushState(newPath);
  }

  // other routes are pushing state independently, so we intercept those args & add
  pushState(path) {
    const [, queryParams = ''] = path.split('?');
    const specialParamString = toParamString(this.get('current'));
    let newPath = path;

    // if there are query params, handle them specially, else append
    if (queryParams) {
      // are any of them special or regular? append the special params if regular
      const incomingKeys = Object.keys(parseParams(queryParams));
      const specialParams = Object.keys(this.get('current'));

      if (!incomingKeys.any(incomingKey => specialParams.includes(incomingKey))
        && specialParamString) {
        // merge with the incoming keys
        newPath += `&${specialParamString}`;
      }
    } else if (specialParamString) {
      // check if there is anything special to append
      newPath += `?${specialParamString}`;
    }

    super.pushState(newPath);
  }
}
