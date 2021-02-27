# Web Navigation Window

This browser extension reads the browsing history over a given period and
renders it as a navigation graph (nodes are visited pages aggregated by domain
name, edges are link traversals or form submissions from one page to another).

## Installation

Clone/download this repository and get the location of `manifest.json` in your
file system.

On Firefox, enter `about:debugging#/runtime/this-firefox` in the address bar.
Then, click "Load Temporary Add-On" and select `manifest.json` from the file
picker. _For more details, see [Mozilla's documentation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)._

On Chrome, enter `chrome://extensions/` in the address bar. Then, activate
"Developer mode" and click "Load unpacked". Select the folder that includes
`manifest.json`.

## Usage

Click on the ship window symbol in the action bar (upper right corner of the
browser). A new tab should open, showing an empty rectangle. Click "Render" to
generate your navigation graph over the indicated period.