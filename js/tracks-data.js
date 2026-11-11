/* Retro Racer - themes and the four tracks (pure data + small color functions).
 *
 * Track format:
 *   points  : closed loop of control points in driving order (640x360 screen space).
 *             The start/finish line is at the first point.
 *   hw      : half-width of the road in pixels.
 *   patches : stretches of road with a special surface, as fractions of the lap (0..1).
 *   boxes   : lap fractions where a row of 3 item boxes sits.
 *   pads    : [lap fraction, lateral offset -1..1] for boost pads.
 *   scatter : how many scenery objects to sprinkle around, and which kinds.
 */
(function (RR) {
  'use strict';

  RR.THEMES = {
    meadow: {
      ground(x, y, h) {
        const stripe = Math.floor((x + y * 0.6) / 24) % 2 === 0;
        let c = stripe ? [84, 178, 76] : [74, 162, 68];
        if (h < 0.05) c = [60, 135, 56];
        else if (h > 0.992) c = h > 0.996 ? [255, 236, 90] : [250, 250, 250];
        return c;
      },
      road: [96, 96, 106], roadNoise: 7, line: [235, 235, 235],
      curbA: [222, 52, 52], curbB: [245, 245, 245],
      sand: [226, 198, 130], ice: [180, 225, 245],
      dust: '#3f8f38', skid: 'rgba(25,25,30,0.22)'
    },
    desert: {
      ground(x, y, h) {
        const w = Math.sin(x * 0.045 + Math.sin(y * 0.07) * 2);
        let c = w > 0.3 ? [230, 180, 108] : [219, 168, 98];
        if (h < 0.06) c = [196, 140, 80];
        else if (h > 0.99) c = [245, 210, 150];
        return c;
      },
      road: [150, 108, 72], roadNoise: 9, line: [242, 226, 190],
      curbA: [200, 80, 40], curbB: [240, 228, 200],
      sand: [242, 216, 150], ice: [180, 225, 245],
      dust: '#c99a5e', skid: 'rgba(70,40,20,0.25)'
    },
    snow: {
      ground(x, y, h) {
        const w = Math.sin(x * 0.03 + y * 0.05) + Math.sin(x * 0.011 - y * 0.02);
        let c = w > 0.5 ? [224, 233, 248] : [240, 245, 252];
        if (h < 0.04) c = [205, 215, 235];
        else if (h > 0.995) c = [255, 255, 255];
        return c;
      },
      road: [104, 110, 128], roadNoise: 6, line: [240, 240, 255],
      curbA: [40, 90, 220], curbB: [245, 245, 255],
      sand: [226, 198, 130], ice: [165, 215, 245],
      dust: '#ffffff', skid: 'rgba(30,35,50,0.2)'
    },
    city: {
      ground(x, y, h) {
        const gx = x % 40, gy = y % 40;
        if (gx === 0 || gy === 0) {
          return ((Math.floor(x / 40) + Math.floor(y / 40)) % 3 === 0) ? [255, 60, 200] : [100, 40, 160];
        }
        let c = [24, 18, 44];
        if (h < 0.008) c = [255, 230, 120];
        else if (h < 0.08) c = [32, 24, 58];
        return c;
      },
      road: [48, 46, 70], roadNoise: 5, line: [255, 220, 80],
      curbA: [0, 220, 255], curbB: [255, 50, 190],
      sand: [226, 198, 130], ice: [180, 225, 245],
      dust: '#ff6ad8', skid: 'rgba(0,0,0,0.3)'
    }
  };

  RR.TRACKS = [
    {
      id: 'meadow', name: 'SUNNY MEADOW', theme: 'meadow', music: 'meadow', stars: 1, hw: 24,
      points: [[320, 305], [130, 305], [55, 245], [55, 125], [130, 62], [320, 62], [510, 62], [585, 125], [585, 245], [510, 305]],
      patches: [],
      boxes: [0.45, 0.92],
      pads: [[0.58, 0], [0.08, 0]],
      scatter: { count: 50, types: ['tree', 'tree', 'tree', 'bush', 'bush', 'flower', 'flower', 'rock'] }
    },
    {
      id: 'canyon', name: 'DUSTY CANYON', theme: 'desert', music: 'canyon', stars: 2, hw: 21,
      points: [[330, 315], [170, 315], [70, 280], [55, 190], [90, 95], [170, 55], [250, 85], [290, 160],
               [360, 190], [430, 150], [450, 85], [530, 55], [595, 110], [570, 190], [600, 260], [520, 315]],
      patches: [{ type: 'sand', from: 0.44, to: 0.52 }, { type: 'sand', from: 0.74, to: 0.80 }],
      boxes: [0.27, 0.9],
      pads: [[0.63, 0], [0.95, 0]],
      scatter: { count: 40, types: ['cactus', 'cactus', 'redrock', 'redrock', 'deadbush', 'deadbush', 'rock'] }
    },
    {
      id: 'frosty', name: 'FROSTY PEAKS', theme: 'snow', music: 'frosty', stars: 2, hw: 21,
      points: [[320, 318], [140, 318], [55, 265], [55, 170], [80, 85], [140, 55], [200, 90], [215, 170],
               [270, 215], [330, 170], [340, 90], [400, 55], [500, 60], [590, 110], [600, 200], [545, 300]],
      patches: [{ type: 'ice', from: 0.60, to: 0.68 }, { type: 'ice', from: 0.03, to: 0.10 }],
      boxes: [0.2, 0.76],
      pads: [[0.5, 0], [0.88, 0]],
      scatter: { count: 44, types: ['pine', 'pine', 'pine', 'snowman', 'snowrock', 'snowrock'] }
    },
    {
      id: 'neon', name: 'NEON CITY', theme: 'city', music: 'neon', stars: 3, hw: 19,
      points: [[130, 318], [230, 280], [320, 190], [410, 100], [500, 55], [585, 85], [605, 190], [585, 295],
               [500, 325], [410, 280], [320, 190], [230, 100], [140, 55], [55, 85], [35, 190], [55, 295]],
      patches: [],
      boxes: [0.3, 0.8],
      pads: [[0.08, 0], [0.55, 0]],
      scatter: { count: 34, types: ['roof', 'roof', 'roof', 'lamp', 'lamp', 'cone'] }
    }
  ];
})(window.RR);
