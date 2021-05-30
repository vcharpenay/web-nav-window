const container = document.getElementById('nav-graph');
const beginCtl = document.getElementById('begin-control');
const endCtl = document.getElementById('end-control');
const renderCtl = document.getElementById('render-control');
const renderMsg = document.getElementById('render-message');
const noDataMsg = document.getElementById('no-data-message');
const anonCtl = document.getElementById('anonymize-control');
const contribCtl = document.getElementById('contribute-control');
const contribData = document.getElementById('contribute-data');

const overlay = document.getElementById('overlay');
const modalCopyCtl = document.getElementById('modal-copy-control');
const modalRenderMsg = document.getElementById('modal-render-message');
const modalCopyMsg = document.getElementById('modal-copy-message');
const modalCloseCtl = document.getElementById('modal-close-control');

function render(e, g) {
    webnav.log('Build view from navigation graph...');

    let nodes = g.nodes.map(n => {
        let group = 'unknown'; // unknown anchor
        if (n.start) group = 'source'; // source of some navigation
        else if (g.edges.some(e => e.to == n.id)) group = 'other'; // part of a navigation

        return {
            id: n.id,
            label: n.dn,
            value: n.pages,
            group: group
        };
    });
    
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
        },
        groups: {
            unknown: {
                color: {
                    border: 'hsl(55, 20%, 70%)',
                    background: 'hsl(55, 20%, 80%)'
                }
            },
            source: {
                color: {
                    border: 'hsl(55, 100%, 40%)',
                    background: 'hsl(55, 100%, 50%)'
                }
            },
            other: {
                color: {
                    border: 'hsl(205, 100%, 40%)',
                    background: 'hsl(205, 100%, 50%)'
                }
            }
        },
        layout: {
            improvedLayout: false
        },
        physics: {
            stabilization: {
                iterations: 200
            }
        }
    };

    webnav.log('Render view...');
    
    webnav.viz = new vis.Network(e, data, options);
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
    Promise.resolve()

    .then(() => {
        renderMsg.hidden = false;
        noDataMsg.hidden = true;
    })

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
    
    .then(() => {
        webnav.viz.on('stabilizationIterationsDone', () => renderMsg.hidden = true);

        if (webnav.graph.nodes.length == 0) {
            renderMsg.hidden = true;
            noDataMsg.hidden = false;
        }
    });
};

anonCtl.onclick = () => {
    let g = webnav.graph;

    if (g) {
        anonymized(g)

        .then(anon => webnav.graph = anon)

        .then(() => renderCtl.onclick());
    }
};

contribCtl.onclick = () => {
    overlay.hidden = false;

    if (contribData.textContent == '') {
        let begin = new Date("2021-04-01");
        let end = new Date("2021-05-31");

        navigation(begin, end)

        .then(g => anonymized(g))
    
        .then(g => {
            contribData.textContent = JSON.stringify(g);
            modalCopyCtl.disabled = false;
            modalRenderMsg.hidden = true;
        });
    }
};

modalCopyCtl.onclick = () => {
    navigator.clipboard.writeText(contribData.textContent)
    
    .then(() => modalCopyMsg.hidden = false);
};

modalCloseCtl.onclick = () => {
    overlay.hidden = true;
    modalCopyMsg.hidden = true;
};

// i18n: populate all text elements with messages in the proper locale

webnav.log(`Detected locale: ${browser.i18n.getUILanguage()}.`);

let textForElement = e => {
    let id = e.id.replace(/-/g, '_');
    return browser.i18n.getMessage(id);
};

let textElements = document.getElementsByClassName('localized-text');
let inputElements = document.getElementsByClassName('localized-control');

for (let i = 0; i < textElements.length; i++) {
    let e = textElements[i];
    e.innerHTML = textForElement(e);
}

for (let i = 0; i < inputElements.length; i++) {
    let e = inputElements[i];
    e.value = textForElement(e);
}