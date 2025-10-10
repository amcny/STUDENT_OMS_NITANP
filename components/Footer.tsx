import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="container mx-auto px-6 py-4">
        <p className="text-center text-sm text-gray-600">
          &copy; {new Date().getFullYear()} National Institute of Technology, Andhra Pradesh
        </p>
      </div>
    </footer>
  );
};

export default Footer;
