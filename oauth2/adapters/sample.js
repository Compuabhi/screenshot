OAuth2.adapter('sample', {
 
  authorizationCodeURL: function(config) {
    return '';
  },

  
  redirectURL: function(config) {
    return '';
  },

  parseAuthorizationCode: function(url) {
    return '';
  },

  
  accessTokenURL: function() {
    return '';
  },

  
  accessTokenMethod: function() {
    return 'POST';
  },

  accessTokenParams: function(authorizationCode, config) {
    return {};
  },

  
  parseAccessToken: function(response) {
    return {
      accessToken: '',
      refreshToken: '',
      expiresIn: Number.MAX_VALUE
    };
  }
});
