import AboutPage from '../pages/about/about-page.js';
import AddPage from '../pages/add/add-page.js';
import FavoritePage from '../pages/favorite/favorite-page.js';
import LoginPage from '../auth/login-page.js';
import RegisterPage from '../auth/register-page.js';
import HomePage from '../pages/home/home-page.js';


const routes = {
  '/home': HomePage,  // default route
  '/about':  AboutPage,
  '/favorite': FavoritePage,
  '/login': LoginPage,
  '/register': RegisterPage,
  '/add': new AddPage(),
};

export default routes;