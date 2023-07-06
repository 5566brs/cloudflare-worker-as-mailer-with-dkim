JS fork of [this](https://github.com/Sh4yy/cloudflare-email) with DKIM support,
see [also](https://gist.github.com/ihsangan/6111b59b9a7b022b5897d28d8454ad8d)

[mailchannels API docs](https://api.mailchannels.net/tx/v1/documentation)

## Instructions

1. Clone this repository
2. Install the dependencies with `npm install`
3. Use the command `npx wrangler secret put --env production TOKEN` to deploy a securely stored token to Cloudflare. With this command, you will be prompted to enter a random secret value, which will be used to authenticate your requests with the HTTP `Authorization` header as described below. You can also set this encrypted value directly in your Cloudflare dashboard.
4. Deploy the worker with `npm run deploy`

Or deploy directly to Cloudflare

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/5566brs/cloudflare-worker-as-mailer-with-dkim)

## Setup SPF

1.  Add a `TXT` record to your domain with the following values:

        - Name: `@`
        - Value: `v=spf1 a mx include:relay.mailchannels.net ~all`

Note: If you're facing [Domain Lockdown error](https://support.mailchannels.com/hc/en-us/articles/16918954360845-Secure-your-domain-name-against-spoofing-with-Domain-Lockdown), follow the below steps:

1.  Create a `TXT` record with the following values:

        - Name: `_mailchannels`
        - Value: `v=mc1 cfid=yourdomain.workers.dev` (the value of `cfid` will also be present in the error response)

## Setup DKIM

You may follow the steps listed in the [MailChannels documentation](https://support.mailchannels.com/hc/en-us/articles/7122849237389-Adding-a-DKIM-Signature) to set up DKIM for your domain.

## Example usage

Once you have deployed this worker function to Cloudflare Workers, you can send emails by making a `POST` request to the worker on the `/api/email` endpoint with the following parameters:

- Note you need to pass an `Authorization` header with the secure token you deployed. Like the following: `Authorization: TOKEN`

js:

```JS
fetch('https://my.mailer.user.workers.dev/api/email', {method: 'POST', body:JSON.stringify({from:'user@example.com', to: 'another@example.com', html: '<div>test</div>', subject: 'this is just a test!'}), headers: {'Authorization':TOKEN}}).then ...
```

curl:

```bash
curl https://my.mailer.user.workers.dev/api/email -H 'Authorization: $TOKEN' -H 'Content-Type: application/json' -d '{"from":"user@example.com", "to": "another@example.com", "html': "<div>test</div>", "subject": "this is just a test!"}'
```

### Basic Email

```json
{
  "to": "john@example.com",
  "from": "me@example.com",
  "subject": "Hello World",
  "text": "Hello World"
}
```

### Sender and Recipient Name

You can also specify a sender and recipient name by adding a `name` parameter to the request. This can be used for both the `to` and `from` parameters.

```json
{
  "to": { "email": "john@example.com", "name": "John Doe" },
  "from": { "email": "me@example.com", "name": "Jane Doe" },
  "subject": "Hello World",
  "text": "Hello World"
}
```

### Sending to Multiple Recipients, cc, bcc

You may also send to multiple recipients by passing an array of emails, or an array of objects with `email` and `name` properties.

```json
{
  "to": ["john@example.com", "rose@example.com"],
  "from": "me@example.com",
  "subject": "Hello World",
  "text": "Hello World"
}
```

or

```json
{
  "to": [
    { "email": "john@example.com", "name": "John Doe" },
    { "email": "rose@example.com", "name": "Rose Doe" }
  ],
  "cc": ["jim@example.com", "rose@example.com"],
  "bcc": ["gil@example.com"],
  "from": "me@example.com",
  "subject": "Hello World",
  "text": "Hello World"
}
```

### Reply To

You can also specify a reply to email address by adding a `replyTo` parameter to the request. Again, you can use an email string, an object with `email` and `name` properties, or an array of either.

```json
{
  "to": "john@example.com",
  "from": "me@example.com",
  "replyTo": "support@example.com",
  "subject": "Hello World",
  "text": "Hello World"
}
```

## DKIM

```json
{
  "dkim_domain": "example.com",
  "dkim_selector": "dk2023",
  "dkim_private_key": "<base64 encoded private key..>"
}
```

or as env vars (see example command above or use browser):

DKIM_DOMAIN=....

DKIM_SELECTOR=...

DKIM_PRIVATE_KEY=`<base64 encoded private key..>`

## Attachments

```json
{
  "attachment": {
    "filename": "file.pdf",
    "data": "<the actual content of the file>"
  }
}
```

or:

```json
{
  "attachment": [
    { "filename": "first.pdf", "data": "<the actual content of the file>" },
    { "filename": "second.pdf", "data": "<the actual content of the file>" }
  ]
}
```