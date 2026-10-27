# getConfig

Source basis:

- Bundled Notification API REST reference extract.
- Bundled modern example payload.

REST-page behavior:

- `getConfig` retrieves a previously created configuration.
- The bundled REST reference lists the Notification API base path as
  `/commerce/notification/v1`.
- The bundled REST reference lists OAuth scope
  `https://api.ebay.com/oauth/api_scope`.

Public method reference:

- `GET /commerce/notification/v1/config`
- Returns the configured `alertEmail` when present.