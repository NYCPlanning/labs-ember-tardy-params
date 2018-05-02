# ember-tardy-params
Bind on-the-fly query parameters to your models

## About
It is not possible to dynamically add _new_ query parameters after the model hook has completed. This addon helps make it possible to manage individual model state in the URL. In our case, we needed to rely on models to manage map layers and layer state. We also wanted the presence of those layer models to handle the query parameters out-of-the-box. 

## Usage
```javascript
  // snip...

  model() {
    return this.store.peekAll('map-layer');
  },

  afterModel({ models }, { queryParams }) {
    const tardyParams = getOwner(this).lookup('location:tardy-params');
    tardyParams.setupQueryParamModels(models, queryParams);
  }

  // snip...
```
