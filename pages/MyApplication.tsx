import React from 'react';
import { Navigate } from 'react-router-dom';

const MyApplication: React.FC = () => {
  return <Navigate to="/" replace />;
};

export default MyApplication;