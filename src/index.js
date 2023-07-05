import isEmail from 'validator/es/lib/isEmail';

const toPersona = (data) => typeof data === 'string' ? { email: data } : data;

const validFrom = (field) => {
    try {
        if (isEmail(field) || (field === 'object' && isEmail(field.email)) || (field === 'object' && field.every(i => isEmail(i.email)))) {
            return true
        }
    } catch (error) {
        console.error(error)
    }

    return false
}

const validTo = (field) => {
    if (isEmail(field) || (field === 'object' && isEmail(field.email))) {
        return true
    }
    return false
}

const send = async (data) => {
    const resp = await fetch(
        new Request('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(data),
        })
    );

    if (resp.status > 299 || resp.status < 200) {
        const respText = await resp.text();
        return new Response(`Error sending email: ${resp.status} ${resp.statusText} ${respText}`, { status: 500 });
    }
}

export default {
    async fetch(request, env, ctx) {

        const url = new URL(request.url);
        const { pathname } = url;

        if (request.method !== 'POST' || pathname !== '/api/email') {
            return new Response('not found', { status: 404 })
        }

        const token = request.headers.get('Authorization');

        if (!env.TOKEN || env.TOKEN.length === 0) {
            return new Response('You must set the TOKEN environment variable.', {
                status: 401,
            });
        }

        if (token !== env.TOKEN) {
            return new Response('Unauthorized', { status: 401 });
        }

        const content = await request.json();

        // to, from, subject, text/html, replyTo, cc, bcc, attachments
        const { to, from, html, text, subject} = content;
        if (!validFrom(from) || !validTo(to) || (!html && !text)|| !subject) {
            return new Response('bad request', { status: 400 });
        }

        let mailData = {
            personalizations: [{
                to: typeof to === 'object' ? to.map(toPersona) : [toPersona(to)],

            }],
            from: toPersona(from),
            content: [],
            subject
        }

        const { cc, bcc, replyTo, dkim_private_key, dkim_selector, dkim_domain } = content;

        if (cc && validTo(cc)) mailData.personalizations[0]['cc'] = typeof cc === 'object' ? cc.map(toPersona) : [toPersona(cc)];
        if (bcc && validTo(bcc)) mailData.personalizations[0]['bcc'] = typeof bcc === 'object' ? bcc.map(toPersona) : [toPersona(bcc)];
        if (html) mailData.content.push({ type: 'text/html', value: html });
        if (text) mailData.content.push({ type: 'text/plain', value: text });
        if (replyTo && validFrom(replyTo)) mailData.personalizations[0]['reply_to'] = toPersona(replyTo);
        if ((dkim_private_key && dkim_selector && dkim_domain) || (env.DKIM_DOMAIN && env.DKIM_SELECTOR && env.DKIM_PRIVATE_KEY)) {
            mailData.personalizations[0] = {
                dkim_private_key: dkim_private_key || env.DKIM_PRIVATE_KEY,
                dkim_selector: dkim_selector || env.DKIM_SELECTOR,
                dkim_domain: dkim_domain || env.DKIM_DOMAIN
            }
        }

        try {
            console.log(JSON.stringify(mailData))
            await send(mailData)
        } catch (e) {
            console.error(`Error sending email: ${e}`);
            return new Response('Internal Server Error', { status: 500 });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: {
                "content-type": "application/json; charset=uft-8",
            },
        });
    },
};