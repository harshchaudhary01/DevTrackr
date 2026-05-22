import React from 'react';

const KPICard = ({ title, value, tip }) => {
  return (
    <div className="glass-card p-4 w-full md:w-1/3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-300">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        {tip && <p className="text-xs text-slate-400">{tip}</p>}
      </div>
    </div>
  );
};

export default KPICard;
