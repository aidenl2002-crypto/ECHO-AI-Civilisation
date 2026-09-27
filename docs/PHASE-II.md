# Phase II: city and citizen foundation

## Play this version

Run `START-ECHO.bat`, then create a **new city** to use the new geography. Existing saves retain their original coordinates and layout; loading them does not relocate homes or citizens. Default population is 120; creation supports up to 1,000.

Drag the map to pan, scroll or use + / − to zoom, and use the rotation buttons to change the view. District names appear at overview zoom. Business names appear closer in; homes appear at neighbourhood detail. Hover or select any building for its name. Aa toggles labels. Selecting a citizen opens their life details and authenticated owner actions.

## Implemented

- Seeded, irregular 3,200 × 2,600 geography with a river, bridge, seven districts, connected street hierarchy, crescents, courts, cul-de-sacs and green spaces.
- Roughly 180 real building records per city, with district-specific architecture, footprints, heights, addresses, entrances and property metadata. Housing, workplaces and businesses use these records.
- Canvas isometric renderer with four camera bearings, architectural facades, roofs, windows and night lighting, shopfronts, street trees, park furniture, industrial parking and gardens. This remains an isometric renderer, not a free-orbit WebGL scene.
- Citizens follow shortest paths through the street network. Unreachable destinations are cancelled safely. Housing occupancy and employment are spread across the city.
- Building inspectors expose actual residents, workers, visitors, hours, inventory and daily sales. Citizen views expose needs, relationships, memories and owner controls.
- Corrected repeated payday processing, limited purchases to stock and physical proximity, added shared household rent and prevented births from exceeding home capacity.
- Legacy saves remain loadable. New geometry is not applied destructively to existing cities.

## Verification

- Full production build passed.
- 29 simulation/API tests passed, covering administration, snapshots, cognition contracts, deterministic generation, road travel, unreachable destinations and legacy saves. The suite's optional live gateway probe encountered sandbox log permissions; an independent live provider probe succeeded outside that restriction.
- Seeds 1, 42, 1337 and 2026 generated 183–186 buildings with room for 1,000 residents and no overcrowded homes.
- Two simulated days at 120 residents retained all citizens and produced social activity. A separate 289-tick check produced eight posts, four linked replies, four conversation events and two news articles.
- Configured OpenCode model returned a schema-valid citizen decision in 4.5 seconds.
- Browser checked the new city, building selection and inspector, camera zoom/rotation and name toggling. Fixed canvas cache resizing during hot reload.

## Scope still ahead

This is the first playable city/citizen phase of the larger Phase II brief. Moving vehicle traffic, dynamic construction and district growth, full household life cycles, expanded company economics, and the requested multi-decade population endurance runs remain future work. Parking vehicles are scenery. Property condition and desirability are generated metadata, not yet a complete property market.

The owner key remains in the local `.env` file (`OWNER_TOKEN`). Enter it in the top bar to enable owner actions. AI needs the configured OpenCode executable and network access; simulation and event-based news/social activity continue without a model response.
