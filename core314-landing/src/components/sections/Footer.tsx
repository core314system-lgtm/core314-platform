export function Footer() {
  return (
    <footer className="py-12 bg-core314-navy border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-xl font-bold text-white mb-4">Core314</h3>
            <p className="text-gray-400 text-sm">
              The AI-powered control core for modern operations.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#how-it-works" className="hover:text-core314-electric-blue">How It Works</a></li>
              <li><a href="#signup" className="hover:text-core314-electric-blue">Pricing</a></li>
              <li><a href="#signup" className="hover:text-core314-electric-blue">Integrations</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#signup" className="hover:text-core314-electric-blue">About</a></li>
              <li><a href="#signup" className="hover:text-core314-electric-blue">Careers</a></li>
              <li><a href="#signup" className="hover:text-core314-electric-blue">Contact</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#signup" className="hover:text-core314-electric-blue">Privacy Policy</a></li>
              <li><a href="#signup" className="hover:text-core314-electric-blue">Terms of Service</a></li>
              <li><a href="#signup" className="hover:text-core314-electric-blue">Security</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
          <p>&copy; {new Date().getFullYear()} Core314. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
