export const DEFAULT_THEME = 'dark';

export const STORAGE_KEYS = {
  commands: 'commands',
  variables: 'variables',
  variableBindings: 'variableBindings',
  theme: 'theme'
};

export const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

export const BLOCKED_HEADER_NAMES = [
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via'
];
