import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Seo from '../components/Seo';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo title="Page Not Found | Core314 Technologies" description="The page you were looking for could not be found." path="/404" noindex />
      <Header />
      <main className="pt-36 pb-24">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-sm font-semibold text-sky-700">404</p>
          <h1 className="mt-2 text-4xl font-bold">We couldn't find that page</h1>
          <p className="mt-4 text-lg text-slate-600">It may have moved when we updated our website.</p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/" className="px-5 py-3 font-semibold text-white bg-slate-900 rounded-lg">Go to the homepage</Link>
            <Link to="/services" className="px-5 py-3 font-semibold text-slate-800 border border-slate-300 rounded-lg">Browse our services</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
