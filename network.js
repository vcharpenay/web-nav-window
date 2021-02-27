const beginCtl = document.getElementById('begin-control');
const endCtl = document.getElementById('end-control');
const renderCtl = document.getElementById('render-control');

renderCtl.onclick = () => {
    let begin = new Date(beginCtl.value);
    let end = new Date(endCtl.value);

    navigation(begin, end)

    .then(g => {
        webnav.log('Build view from navigation graph...');

        let container = document.getElementById('nav-graph');

        let nodes = g.nodes.map(n => ({
            id: n.dn,
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
        
        let network = new vis.Network(container, data, options);
    });
};