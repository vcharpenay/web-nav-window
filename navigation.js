const hypermediaTransitions = ['link', 'form_submitted', 'auto_subframe', 'manual_subframe'];
const startTransitions = ['typed', 'auto_bookmark', 'generated', 'keyword', 'keyword_generated', 'reload'];

// TODO include skos:prefLabel|skos:altLabel (makes Wikidata endpoint crash?)
const typeQuery = 'select distinct ?type where {\
  values ?url { <http://{dn}> <http://{dn}/> <https://{dn}> <https://{dn}/> }\
  ?e wdt:P856 ?url ; wdt:P31 ?type .\
}';

function domainName(url) {
    return URI.parse(url).host;
}

function topLevel(dn) {
    let i = dn.lastIndexOf('.');
    return dn.substring(i + 1);
}

function pathNavigation(fromUrl, toUrl) {
    let fromPath = fromUrl.path;
    let toPath = toUrl.path;

    if (toPath == fromPath) return 'self';

    if (toPath.includes(fromPath)) return 'subpath';
    else if (fromPath.includes(toPath)) return 'subpath_inverse';

    let fromIdx = fromPath.lastIndexOf('/');
    let toIdx = toPath.lastIndexOf('/');

    if (fromIdx > -1 && toIdx > -1) {
        let fromParent = fromPath.substring(0, fromIdx);
        let fromLeaf = fromPath.substring(fromIdx);
        let toParent = toPath.substring(0, toIdx);
        let toLeaf = toPath.substring(toIdx);

        if (fromParent == toParent && fromLeaf != toLeaf) return 'sibling';
    }
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
        startTime: begin.getTime(),
        endTime: end.getTime(),
        maxResults: 1000000 // TODO any limit?
    })

    .then(h => {
        webnav.log(`Found ${h.length} history items.`);
        webnav.log('Aggregate history items by domain name...');

        let dnIndex = {};
        let navIndex = {};
    
        let dns = [];
        let nav = [];

        let inc = 0;

        let promises = h.map(item => {
            let dn = domainName(item.url);
            item.dn = dn;
    
            // TODO replay history with the same profile (cookies) and monitor network

            if (dn) {
                if (!dnIndex[dn]) {
                    let dnObj = { id: inc++, dn: dn, pages: 0 };
                    dnIndex[dn] = dnObj;
                    dns.push(dnObj);
                }

                dnIndex[dn].pages++;
    
                return visits(item.url, begin, end)
                .then(v => v.forEach(visit => {
                    // index visits by ID
                    navIndex[visit.visitId] = visit;
                    // add reference to history item from visit
                    visit.item = item;
                }));
            }
        });
    
        return Promise.all(promises)
        .then(() => {
            webnav.log(`Collected ${dns.length} domain names.`);
            webnav.log('Build edge list (i.e. link traversals) by domain name...');

            // TODO instead of scanning navIndex, build edges on-the-fly while building nodes (chronologically ordered list?)

            Object.keys(navIndex).forEach(key => {
                let transition = navIndex[key].transition;

                if (hypermediaTransitions.includes(transition)) {
                    let to = navIndex[key];
                    let from = navIndex[to.referringVisitId];

                    if (from) {
                        let navObj = {
                            from: dnIndex[from.item.dn].id,
                            to: dnIndex[to.item.dn].id,
                            hctl: transition,
                            t: to.visitTime
                        };

                        if (from.item.dn == to.item.dn) {
                            let fromUrl = URI.parse(from.item.url);
                            let toUrl = URI.parse(to.item.url);

                            navObj.path = pathNavigation(fromUrl, toUrl);

                            if (navObj.path == 'self') {
                                navObj.hash = fromUrl.fragment != toUrl.fragment;
                                navObj.q = fromUrl.query != toUrl.query;
                            }
                        }

                        nav.push(navObj);
                    } else {
                        // FIXME link traversal without anchor?

                        // possible cause:
                        // - hash URI (from same resource path)
                        // - generated by JS code? (E.g. with new query parameter)
                        // - link from e-mail or other program?
                        // - page reloaded? (transition type should be "reloaded")
                        // - opened in new tab
                    }
                } else if (startTransitions.includes(transition)) {
                    let dnStart = navIndex[key].item.dn;
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
        + '\t1. Build domain name hierarchy and keep parent/child relation\n'
        + '\t2. Retrieve website class on Wikidata, if any [skipped]\n'
        + '\t3. Keep only top-level domain names and website class');
        
    let root = {
        name: '',
        children: []
    };

    let inc = -1;

    // build domain name tree
    graph.nodes.forEach(n => {
        n.dn.split('.').reverse().reduce((parent, name, i, h) => {
            let child = parent.children.find(c => c.name == name);

            if (!child) {
                child = { id: inc--, level: i, name: name, children: [] };
                parent.children.push(child);
            }

            if (i == h.length - 1) child.value = n;

            return child;
        }, root);
    });

    // add pointers to child nodes if they exist
    let indexRec = treeNode => {
        // index only if under TLD
        if (treeNode.level > 1) {
            let id = treeNode.id;
            // if parent is not in browser history, id
            // helps retain information about siblings
            if (treeNode.value) id = treeNode.value.id;
    
            treeNode.children.forEach(c => {
                if (c.value) c.value.parent = id;
            });
        }

        treeNode.children.forEach(indexRec);
    };

    indexRec(root);

    let promises = [];

    graph.nodes.forEach(n => {
        let dn = n.dn;

         // TODO make query more efficient (or load in background)

        // let p = type(dn) // TODO aggregate for 5-10 entities
        // .then(t => {
        //     n.type = t;
        //     webnav.log(`Found the following types for ${dn}: ${t}.`);
        // });
        let p = Promise.resolve();

        promises.push(p);

        n.dn = '*.' + topLevel(dn);
    });

    return Promise.all(promises).then(() => graph); // TODO graph is modified in place. Is necessary?
}