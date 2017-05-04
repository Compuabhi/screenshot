
var OAuth2 = function(adapterName, config, callback) {
  this.adapterName = adapterName;
  var that = this;
  OAuth2.loadAdapter(adapterName, function() {
    that.adapter = OAuth2.adapters[adapterName];
    if (config == OAuth2.FINISH) {
      that.finishAuth();
    } else if (config) {
      that.updateLocalStorage();

      var data = that.get();
      data.clientId = config.client_id;
      data.clientSecret = config.client_secret;
      data.apiScope = config.api_scope;
      that.setSource(data);
    }
	  if(callback) callback.call(that);
  });
};


OAuth2.FINISH = 'finish';


OAuth2.adapters = {};
OAuth2.adapterReverse = localStorage.oauth2_adapterReverse &&
    JSON.parse(localStorage.oauth2_adapterReverse) || {};

if (localStorage.adapterReverse) {
  OAuth2.adapterReverse = JSON.parse(localStorage.adapterReverse);
  delete localStorage.adapterReverse;
}


OAuth2.prototype.updateLocalStorage = function() {

  if (this.getSource()) {
    return;
  }
  var data = {};
  var variables = [
    'accessToken', 'accessTokenDate', 'apiScope', 'clientId', 'clientSecret',
    'expiresIn', 'refreshToken'
  ];

  var key;
  for (var i = 0; i < variables.length; i++) {
    key = this.adapterName + '_' + variables[i];
    if (localStorage.hasOwnProperty(key)) {
      data[variables[i]] = localStorage[key];
      delete localStorage[key];
    }
  }

  this.setSource(data);
};


OAuth2.prototype.openAuthorizationCodePopup = function(callback) {
 
  window['oauth-callback'] = callback;

  
  chrome.tabs.create({url: this.adapter.authorizationCodeURL(this.getConfig())},
  function(tab) {
   .
  });
};


OAuth2.prototype.getAccessAndRefreshTokens = function(authorizationCode, callback) {
  var that = this;

  var xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', function(event) {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {

        callback(that.adapter.parseAccessToken(xhr.responseText));
      }
    }
  });

  var method = that.adapter.accessTokenMethod();
  var items = that.adapter.accessTokenParams(authorizationCode, that.getConfig());
  var key = null;
  if (method == 'POST') {
    var formData = new FormData();
    for (key in items) {
      formData.append(key, items[key]);
    }
    xhr.open(method, that.adapter.accessTokenURL(), true);
    xhr.send(formData);
  } else if (method == 'GET') {
    var url = that.adapter.accessTokenURL();
    var params = '?';
    for (key in items) {
      params += encodeURIComponent(key) + '=' +
                encodeURIComponent(items[key]) + '&';
    }
    xhr.open(method, url + params, true);
    xhr.send();
  } else {
    throw method + ' is an unknown method';
  }
};


OAuth2.prototype.refreshAccessToken = function(refreshToken, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function(event) {
    if (xhr.readyState == 4) {
      if(xhr.status == 200) {
        // Parse response with JSON
        var obj = JSON.parse(xhr.responseText);
        // Callback with the tokens
        callback(obj.access_token, obj.expires_in);
      }
    }
  };

  var data = this.get();
  var formData = new FormData();
  formData.append('client_id', data.clientId);
  if (data.clientSecret) {
    formData.append('client_secret', data.clientSecret);
  }
  formData.append('refresh_token', refreshToken);
  formData.append('grant_type', 'refresh_token');
  xhr.open('POST', this.adapter.accessTokenURL(), true);
  xhr.send(formData);
};


OAuth2.prototype.finishAuth = function() {
  var authorizationCode = null;
  var that = this;

  
  function callback(error) {
    var views = chrome.extension.getViews();
    for (var i = 0, view; view = views[i]; i++) {
      if (view['oauth-callback']) {
        view['oauth-callback'](error);
       
      }
    }

  
    window.open('', '_self', '');
    window.close();
  }

  try {
    authorizationCode = that.adapter.parseAuthorizationCode(window.location.href);
    console.log(authorizationCode);
  } catch (e) {
    console.error(e);
    callback(e);
  }

  that.getAccessAndRefreshTokens(authorizationCode, function(response) {
    var data = that.get();
    data.accessTokenDate = new Date().valueOf();

    // Set all data returned by the OAuth 2.0 provider.
    for (var name in response) {
      if (response.hasOwnProperty(name) && response[name]) {
        data[name] = response[name];
      }
    }

    that.setSource(data);
    callback();
  });
};

OAuth2.prototype.isAccessTokenExpired = function() {
  var data = this.get();
  return (new Date().valueOf() - data.accessTokenDate) > data.expiresIn * 1000;
};


OAuth2.prototype.get = function(name) {
  var src = this.getSource();
  var obj = src ? JSON.parse(src) : {};
  return name ? obj[name] : obj;
};


OAuth2.prototype.set = function(name, value) {
  var obj = this.get();
  obj[name] = value;
  this.setSource(obj);
};


OAuth2.prototype.clear = function(name) {
  if (name) {
    var obj = this.get();
    delete obj[name];
    this.setSource(obj);
  } else {
    delete localStorage['oauth2_' + this.adapterName];
  }
};


OAuth2.prototype.getSource = function() {
  return localStorage['oauth2_' + this.adapterName];
};


OAuth2.prototype.setSource = function(source) {
  if (!source) {
    return;
  }
  if (typeof source !== 'string') {
    source = JSON.stringify(source);
  }
  localStorage['oauth2_' + this.adapterName] = source;
};


OAuth2.prototype.getConfig = function() {
  var data = this.get();
  return {
    clientId: data.clientId,
    clientSecret: data.clientSecret,
    apiScope: data.apiScope
  };
};


OAuth2.loadAdapter = function(adapterName, callback) {
  // If it's already loaded, don't load it again
  if (OAuth2.adapters[adapterName]) {
    callback();
    return;
  }
  var head = document.querySelector('head');
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = '/oauth2/adapters/' + adapterName + '.js';
  script.addEventListener('load', function() {
    callback();
  });
  head.appendChild(script);
};


OAuth2.adapter = function(name, impl) {
  var implementing = 'authorizationCodeURL redirectURL accessTokenURL ' +
    'accessTokenMethod accessTokenParams accessToken';

  // Check for missing methods
  implementing.split(' ').forEach(function(method, index) {
    if (!method in impl) {
      throw 'Invalid adapter! Missing method: ' + method;
    }
  });

  // Save the adapter in the adapter registry
  OAuth2.adapters[name] = impl;
  // Make an entry in the adapter lookup table
  OAuth2.adapterReverse[impl.redirectURL()] = name;
  // Store the the adapter lookup table in localStorage
  localStorage.oauth2_adapterReverse = JSON.stringify(OAuth2.adapterReverse);
};


OAuth2.lookupAdapterName = function(url) {
  var adapterReverse = JSON.parse(localStorage.oauth2_adapterReverse);
  return adapterReverse[url];
};


OAuth2.prototype.authorize = function(callback) {
  var that = this;
  OAuth2.loadAdapter(that.adapterName, function() {
    that.adapter = OAuth2.adapters[that.adapterName];
    var data = that.get();
    if (!data.accessToken) {
      // There's no access token yet. Start the authorizationCode flow
      that.openAuthorizationCodePopup(callback);
    } else if (that.isAccessTokenExpired()) {
      // There's an existing access token but it's expired
      if (data.refreshToken) {
        that.refreshAccessToken(data.refreshToken, function(at, exp) {
          var newData = that.get();
          newData.accessTokenDate = new Date().valueOf();
          newData.accessToken = at;
          newData.expiresIn = exp;
          that.setSource(newData);
          // Callback when we finish refreshing
          if (callback) {
            callback();
          }
        });
      } else {
        // No refresh token... just do the popup thing again
        that.openAuthorizationCodePopup(callback);
      }
    } else {
      // We have an access token, and it's not expired yet
      if (callback) {
        callback();
      }
    }
  });
};


OAuth2.prototype.getAccessToken = function() {
  return this.get('accessToken');
};


OAuth2.prototype.hasAccessToken = function() {
  return !!this.get('accessToken');
};

OAuth2.prototype.clearAccessToken = function() {
  this.clear('accessToken');
};
