const hypermediaTransitions = ['link', 'form_submitted', 'auto_subframe', 'manual_subframe'];
const startTransitions = ['typed', 'auto_bookmark', 'generated', 'keyword', 'keyword_generated'];

// TODO include skos:prefLabel|skos:altLabel (makes Wikidata endpoint crash?)
const typeQuery = 'select distinct ?type where {\
  values ?url { <http://{dn}> <http://{dn}/> <https://{dn}> <https://{dn}/> }\
  ?e wdt:P856 ?url ; wdt:P31 ?type .\
}';

function domainName(url) {
    let capture = url.match(/https?:\/\/([^:\/]+)[:\/]/);
    // TODO return null if IP
    return capture ? capture[1] : null;
}

function topLevel(dn) {
    let i = dn.lastIndexOf('.');
    return dn.substring(i + 1);
}

function type(dn) {
    let q = encodeURI(typeQuery.replace(/\{dn\}/g, dn));

    let attempts = 0;

    let request = i => {
        if (i > 2) {
            webnav.log(`Too many attempts at reaching Wikidata for ${dn}, giving up...`);
            return Promise.resolve(null);
        } else {
            return fetch(`https://query.wikidata.org/sparql?query=${q}`, {
                headers: {
                    'User-Agent': 'web-nav-window/v1 (https://github.com/vcharpenay/web-nav-window)',
                    'Accept': 'application/sparql-results+json'
                }
            });
        }
    };

    return request(attempts)

    .then(res => {
        // OK
        if (res.ok) return res;

        // Too many requests
        if (res.status == 429) {
            return new Promise((resolve, reject) => {
                let delay = Number(res.headers['Retry-After']) || 60;

                webnav.log(`Reached Wikidata's query limit rate, retrying in ${delay}s...`);

                setTimeout(() => {
                    return request(++attempts)
                    .then(res => resolve(res));
                }, delay * 1200); // x1.2 server-defined delay
            });
        } else {
            webnav.log(`Got unexpected response status from Wikidata: ${res.status} ${res.statusText}.`);
        }
    })

    .then(res => res ? res.json() : null)

    .then(json => {
        if (!json) return null;
        else return json.results.bindings.map(b => b.type.value.replace('http://www.wikidata.org/entity/', ''));
    });
}

function visits(url, begin, end) {
    return browser.history.getVisits({ url: url })
    .then(v => v.filter(visit => visit.visitTime > begin && visit.visitTime < end));
}

function navigation(begin, end) {
    webnav.log('Search history...');

    return browser.history.search({
        text: '',
        startTime: begin,
        endTime: end,
        maxResults: 1000000 // TODO any limit?
    })

    .then(h => {
        webnav.log(`Found ${h.length} history items.`);
        webnav.log('Aggregate history items by domain name...');

        let dnIndex = {};
        let itemIndex = {};
        let navIndex = {};
    
        let dns = [];
        let nav = [];

        let inc = 0;

        let promises = h.map(item => {
            let dn = domainName(item.url);
            itemIndex[item.id] = dn;
    
            // TODO replay history with the same profile (cookies) and monitor network

            if (dn) {
                if (!dnIndex[dn]) {
                    let dnObj = { id: inc++, dn: dn, pages: 0 };
                    dnIndex[dn] = dnObj;
                    dns.push(dnObj);
                }

                dnIndex[dn].pages++;
    
                return visits(item.url, begin, end)
                // index visits by ID
                .then(v => v.forEach(visit => navIndex[visit.visitId] = visit));
            }
        });
    
        return Promise.all(promises)
        .then(() => {
            webnav.log(`Collected ${dns.length} domain names.`);
            webnav.log('Build edge list (i.e. link traversals) by domain name...');

            Object.keys(navIndex).forEach(key => {
                let transition = navIndex[key].transition;
                if (hypermediaTransitions.includes(transition)) {
                    let to = navIndex[key];
                    let from = navIndex[to.referringVisitId];

                    if (from) {
                        nav.push({
                            from: dnIndex[itemIndex[from.id]].id,
                            to: dnIndex[itemIndex[to.id]].id,
                            hctl: transition,
                            t: to.visitTime
                        });
                    }
                    // else console.error(to); // FIXME link traversal without anchor?
                } else if (startTransitions.includes(transition)) {
                    let dnStart = itemIndex[navIndex[key].id];
                    dnIndex[dnStart].start = transition;
                }
            });

            webnav.log(`Found ${nav.length} link traversals.`);
        
            return {
                nodes: dns,
                edges: nav
            };
        });
    });
}

function anonymized(graph) {
    webnav.log('Anonymize navigation graph...\n'
        + '\t1. Retrieve website class on Wikidata, if any\n'
        + '\t2. Keep only top-level domain names and website class');

    let promises = [];

    graph.nodes.forEach(n => {
        let dn = n.dn;

        let p = type(dn)
        .then(t => {
            n.type = t;
            webnav.log(`Found the following types for ${dn}: ${t}.`);
        });

        promises.push(p);

        n.dn = '*.' + topLevel(dn);
    });

    return Promise.all(promises).then(() => graph); // TODO graph is modified in place. Is necessary?
}