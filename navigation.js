const hypermediaTransitions = ['link', 'form_submitted', 'auto_subframe', 'manual_subframe'];
const startTransitions = ['typed', 'auto_bookmark', 'generated', 'keyword', 'keyword_generated'];

function domainName(url) {
    let capture = url.match(/https?:\/\/([^:\/]+)[:\/]/);
    return capture ? capture[1] : null;
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

        let promises = h.map(item => {
            let dn = domainName(item.url);
            itemIndex[item.id] = dn;
    
            if (dn) {
                if (!dnIndex[dn]) {
                    let dnObj = { dn: dn, pages: 0 };
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
                            from: itemIndex[from.id],
                            to: itemIndex[to.id],
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