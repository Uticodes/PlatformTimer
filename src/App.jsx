import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Operator from './screens/Operator';
import Display from './screens/Display';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Operator />} />
        <Route path="/display" element={<Display />} />
      </Routes>
    </Router>
  );
}

export default App;
