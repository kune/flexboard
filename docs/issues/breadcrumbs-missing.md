_Status_: Fixed

_Given_: 
In the board view (after opening a specific board) I see breadcrumbs at the top: Flexboard / Boards / Alex's Board

_When_: 
When I open or edit a specific card

_Actual_: 
Those breadcrubmbs are missing completely. 

_Expected_: 
I have the same style breadcrumbs as in the board view. E.g., Flexboard / Boards / Alex's Board / Card Title

_Fix_:
The `Board` page cleared the breadcrumb store on unmount, so by the time `CardDetail` was rendered, `boardName` was already null.

Extended `uiStore` with `boardId` and `cardTitle`. `CardDetail` now fetches the board to populate the board crumb, then sets `cardTitle` once the card loads. `Nav` renders a two-level crumb when `cardTitle` is present, with the board name as a link back to the board.
