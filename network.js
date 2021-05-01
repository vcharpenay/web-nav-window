const container = document.getElementById('nav-graph');
const beginCtl = document.getElementById('begin-control');
const endCtl = document.getElementById('end-control');
const renderCtl = document.getElementById('render-control');
const renderMsg = document.getElementById('render-message');
const anonCtl = document.getElementById('anonymize-control');

// TODO if end is before begin, set to a later day

function render(e, g) {
    webnav.log('Build view from navigation graph...');

    let nodes = g.nodes.map(n => ({
        id: n.id,
        label: n.dn,
        value: n.pages,
        group: n.start ? 0 : 1
    }));
    
    let edgeIndex = {};
    let edges = g.edges.reduce((edges, e) => {
        let key = e.from + ' ' + e.to;

        if (!edgeIndex[key]) {
            let val = {
                from: e.from,
                to: e.to,
                value: 0
            };

            edgeIndex[key] = val;
            edges.push(val);
        }

        edgeIndex[key].value++;

        return edges;
    }, []);

    let data = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(edges)
    };
    
    let options = {
        nodes: {
            shape: 'dot'
        },
        edges: {
            arrows: {
                to: {
                    enabled: true
                }
            }
        }
    };

    webnav.log('Render view...');
    
    let network = new vis.Network(e, data, options);
}

beginCtl.onchange = () => {
    let begin = new Date(beginCtl.value);
    let end = new Date(endCtl.value);

    if (begin > end) {
        let toString = d => d.toISOString().split('T')[0];

        beginCtl.value = toString(end);
        endCtl.value = toString(begin);
    }

    webnav.graph = null; // refresh navigation graph
};

endCtl.onchange = beginCtl.onchange;

renderCtl.onclick = () => {
    let promise = Promise.resolve()

    .then(() => renderMsg.hidden = false)

    .then(() => {
        if (webnav.graph) {
            return Promise.resolve();
        } else {
            let begin = new Date(beginCtl.value);
            let end = new Date(endCtl.value);

            return navigation(begin, end)

            .then(g => webnav.graph = g);
        }
    })

    .then(() => render(container, webnav.graph))
    
    .then(() => renderMsg.hidden = true);
};

anonCtl.onclick = () => {
    let g = webnav.graph;
    if (g) {
        anonymized(g)

        .then(anon => webnav.graph = anon)

        .then(() => renderCtl.onclick());
    }
};