const hypermediaTransitions = ['link', 'form_submitted', 'auto_subframe', 'manual_subframe'];
const startTransitions = ['typed', 'auto_bookmark', 'generated', 'keyword', 'keyword_generated'];

function domainName(url) {
    let capture = url.match(/https?:\/\/([^:\/]+)[:\/]/);
    // TODO return null if IP
    return capture ? capture[1] : null;
}

function topLevel(dn) {
    let i = dn.lastIndexOf('.');
    return dn.substring(i + 1);
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
    // keep only top-level domain name,
    // look for 'alias'|'official website' and extract 'instance of' 

    graph.nodes.forEach(n => {
        n.dn = '*.' + topLevel(n.dn);
        // TODO SPARQL query
    });

    return graph; // TODO graph is modified in place. Is necessary?
}