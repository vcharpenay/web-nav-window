const container = document.getElementById('nav-graph');
const beginCtl = document.getElementById('begin-control');
const endCtl = document.getElementById('end-control');
const renderCtl = document.getElementById('render-control');
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
        }
    };

    webnav.log('Render view...');
    
    let network = new vis.Network(e, data, options);
}

renderCtl.onclick = () => {
    let promise = null;

    if (webnav.graph) {
        promise = Promise.resolve();
    } else {
        let begin = new Date(beginCtl.value);
        let end = new Date(endCtl.value);

        promise = navigation(begin, end)

        .then(g => webnav.graph = g);
    }

    promise.then(() => render(container, webnav.graph));
};

anonCtl.onclick = () => {
    let g = webnav.graph;
    if (g) {
        webnav.graph = anonymized(g);
        renderCtl.onclick();
    }
};