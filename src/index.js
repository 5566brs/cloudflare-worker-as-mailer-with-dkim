import isEmail from 'validator/es/lib/isEmail';

const toPersona = (data) => typeof data === 'string' ? { email: data } : data;

const tryIsEmail = (email) => {
    try {
        return isEmail(email);
    } catch (error) {
        return false;
    }

}

const validTo = (field) => {
    try {
        if (tryIsEmail(field) ||
            (typeof field === 'object' && tryIsEmail(field.email)) ||
            (typeof field === 'object' && field.every(i => tryIsEmail(i.email))) ||
            (typeof field === 'object' && field.every(i => tryIsEmail(i)))) {
            return true
        }
    } catch (error) {
        return false
    }

    return false
}

const validFrom = (field) => {
    try {
        if (tryIsEmail(field) || (typeof field === 'object' && tryIsEmail(field.email))) {
            return true
        }
    } catch (error) {
        console.error(error)
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
        throw new Error(`${resp.status} ${resp.statusText} ${respText}`);
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

        const { to, from, html, text, subject } = content;

        if (!validFrom(from) || !validTo(to) || (!html && !text) || !subject) {
            return new Response('bad request', { status: 400 });
        }

        let mailData = {
            personalizations: [{
                to: Array.isArray(to) ? to.map(toPersona) : [toPersona(to)],

            }],
            from: toPersona(from),
            content: [],
            subject
        }

        const { cc, bcc, replyTo, dkim_private_key, dkim_selector, dkim_domain, attachment } = content;

        if (cc && validTo(cc)) mailData.personalizations[0]['cc'] = Array.isArray(cc) ? cc.map(toPersona) : [toPersona(cc)];
        if (bcc && validTo(bcc)) mailData.personalizations[0]['bcc'] = Array.isArray(bcc) ? bcc.map(toPersona) : [toPersona(bcc)];
        if (html) mailData.content.push({ type: 'text/html', value: html });
        if (text) mailData.content.push({ type: 'text/plain', value: text });
        if (replyTo && validFrom(replyTo)) mailData['reply_to'] = toPersona(replyTo);
        if ((dkim_private_key && dkim_selector && dkim_domain) || (env.DKIM_DOMAIN && env.DKIM_SELECTOR && env.DKIM_PRIVATE_KEY)) {
            mailData.personalizations[0]['dkim_private_key'] = dkim_private_key || env.DKIM_PRIVATE_KEY;
            mailData.personalizations[0]['dkim_selector'] = dkim_selector || env.DKIM_SELECTOR,
                mailData.personalizations[0]['dkim_domain'] = dkim_domain || env.DKIM_DOMAIN
        }
        if (attachment) {
            let attachmentArr = []
            if (!Array.isArray(attachment)) {
                attachmentArr.push(attachment);
            } else {
                attachmentArr = attachment;
            }
            if (attachmentArr.some(att => !att.filename || !att.data)) {
                return new Response('bad request', { status: 400 });
            }
            attachmentArr.forEach(att => mailData.content.push({ type: `application/octet-stream; name="${att.filename}"; Content-Disposition: attachment; filename="${att.filename}"`, value: att.data }));
        }

        try {
            console.log(JSON.stringify(mailData))
            await send(mailData)
        } catch (e) {
            console.error(`Error sending email: ${e}`);
            return new Response(`Error sending email: ${e}`, { status: 500 });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: {
                "content-type": "application/json; charset=uft-8",
            },
        });
    },
};