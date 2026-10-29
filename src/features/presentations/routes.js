// Internal routes for the Presentations feature (ported from Cønstellation).
// The coordinator wires these in src/App.jsx:
//   /presentations            -> StudioPage (new deck)
//   /presentations/deck/:id   -> StudioPage (open an existing deck)
//   /presentations/projects   -> ProjectsPage
export const PRESENTATIONS_ROUTES = {
  studio: '/presentations',
  deck: (id) => `/presentations/deck/${id}`,
  deckPattern: '/presentations/deck/:id',
  projects: '/presentations/projects'
};
