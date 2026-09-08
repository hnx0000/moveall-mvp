import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { mountZoomReadout } from './map-toolbar.mjs';
const read = file => readFile(new URL(file, import.meta.url), 'utf8');

test('tool order follows the two annotated references in DOM and keyboard order', async () => {
  const [national, detail, mobileCSS, detailCSS] = await Promise.all(['index.html','detail.html','mobile-map.css','detail-hud.css'].map(read));
  const ids = html => [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const nationalTools = national.split('<div class="map-controls"')[1].split('<div class="heat-legend"')[0];
  const detailTools = detail.split('<div class="map-actions"')[1].split('<aside')[0];
  assert.deepEqual(ids(nationalTools), ['tilt-toggle','compass','zoom-in','national-zoom-value','zoom-out','gps-locate','open-course','ranking-toggle','reset-view']);
  assert.deepEqual(ids(detailTools), ['detail-tilt','detail-compass','detail-zoom-in','zoom-value','detail-zoom-out','detail-locate','course-pin-toggle','route-follow']);
  assert.doesNotMatch(mobileCSS+detailCSS, /order:\s*-[123]/);
  for(const page of [national, detail]) assert.equal(ids(page).length, new Set(ids(page)).size);
  const ranking = nationalTools.split('id="ranking-toggle"')[1].split('</button>')[0];
  assert.match(ranking, /<svg/);assert.doesNotMatch(ranking, /<span|<small|>랭킹</);
});

test('both maps load the same final zoom capsule styles and keep +, live value, minus', async () => {
  const [national, detail, css, app, detailJS] = await Promise.all(['index.html','detail.html','map-toolbar.css','app.js','detail.js'].map(read));
  for (const page of [national, detail]) {
    const styles = [...page.matchAll(/rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(styles.slice(-2),['map-toolbar.css','map-brand.css']);
    const zoom = page.split('<div class="zoom-control"')[1].split('</div>')[0];
    assert.match(zoom,/role="group" aria-label="지도 확대·축소"/);
    assert.match(zoom,/>＋<\/button>[\s\S]*<output[^>]*aria-live="off"[\s\S]*>−<\/button>/);
  }
  assert.match(css,/\.map-controls>\.zoom-control,\.detail-shell \.map-actions>\.zoom-control/);
  assert.match(css,/background:#151618e6/);assert.match(css,/border-radius:12px/);
  assert.match(css,/min-height:44px!important;height:44px!important/);
  assert.match(css,/\.zoom-control output \{\s*display:block/);
  assert.match(app,/mountZoomReadout\(map, document.getElementById\('national-zoom-value'\)\)/);
  assert.match(detailJS,/mountZoomReadout\(map, \$\('zoom-value'\)\)/);
  for(const source of [app,detailJS]) {
    assert.match(source,/zoom-in"\].*addEventListener|detail-zoom-in"\).*addEventListener/);
    assert.match(source,/zoomOut\(/);assert.match(source,/zoomIn\(/);
  }
});

test('zoom readout starts at actual map zoom and tracks buttons, pinch, wheel and region moves', () => {
  class Map extends EventEmitter {
    zoom=6.8;getZoom(){return this.zoom;}
    setZoom(value){this.zoom=value;this.emit('zoom');}
    zoomIn(){this.setZoom(this.zoom+1);}zoomOut(){this.setZoom(this.zoom-1);}
  }
  const map=new Map(),output={};const dispose=mountZoomReadout(map,output);
  assert.equal(output.textContent,'6.8');
  map.zoomIn();assert.equal(output.textContent,'7.8');
  map.zoomOut();assert.equal(output.textContent,'6.8');
  map.setZoom(14.26);assert.equal(output.textContent,'14.3');
  map.setZoom(4.5);assert.equal(output.textContent,'4.5');
  dispose();map.setZoom(8);assert.equal(output.textContent,'4.5');
});
