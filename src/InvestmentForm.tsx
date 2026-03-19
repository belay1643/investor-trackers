import React from 'react';

type Props = {
  onClose: () => void;
  onSave: (data: any) => void;
};

const InvestmentForm: React.FC<Props> = ({ onClose, onSave }) => (
  <div className="investment-form-overlay">
    <div className="investment-form-container">
      <h2>Add Investment</h2>
      <p>This is a placeholder form.</p>
      <div className="form-actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={() => onSave({})}>Save</button>
      </div>
    </div>
  </div>
);

export default InvestmentForm;
