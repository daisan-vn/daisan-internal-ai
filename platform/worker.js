// Worker tối giản: phục vụ SPA tĩnh trong ./dist. not_found_handling = SPA
// nên mọi route (vd /dashboard, /chat) đều trả index.html cho React Router.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
