import React from 'react';
import './Approvals.css';

interface PendingTransaction {
    _id: string;
    amount: string;
    company?: string;
    requestedBy?: string;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected' | string;
    timestamp?: string;
}

interface ApprovalDecision {
    id: string;
    transactionId: string;
    approver: string;
    timestamp: string;
    rationale: string;
    outcome: 'approved' | 'rejected';
}

type Props = {
    currentCompany: string;
};

function Approvals({ currentCompany }: Props) {
    const [pendingTransactions, setPendingTransactions] = React.useState<PendingTransaction[]>([]);
    const [approvalDecisions, setApprovalDecisions] = React.useState<ApprovalDecision[]>([]);
    const [loading, setLoading] = React.useState(true);

    const loadPendingTransactions = React.useCallback(async () => {
        setLoading(true);
        try {
            const queryParts = ['status=pending'];
            if (currentCompany) {
                queryParts.push(`company=${encodeURIComponent(currentCompany)}`);
            }
            const res = await fetch(`/api/transactions?${queryParts.join('&')}`);
            if (!res.ok) throw new Error('Failed to load pending transactions');
            const data = await res.json();
            if (Array.isArray(data)) {
                const mapped: PendingTransaction[] = data.map((t: any) => ({
                    _id: t._id || t.id,
                    amount: t.amount || '',
                    company: t.company || '',
                    requestedBy: t.requestedBy || '',
                    reason: t.description || '',
                    status: (t.status || '').toString().toLowerCase(),
                    timestamp: t.createdAt || t.date || ''
                }));
                setPendingTransactions(mapped);
            } else {
                console.warn('Unexpected response for pending transactions', data);
                setPendingTransactions([]);
            }
        } catch (error) {
            console.error('Error loading pending transactions:', error);
            setPendingTransactions([]);
        } finally {
            setLoading(false);
        }
    }, [currentCompany]);

    React.useEffect(() => {
        loadPendingTransactions();
    }, [loadPendingTransactions]);

    const handleApprove = async (transactionId: string | number) => {
        const idStr = String(transactionId);
        const transaction = pendingTransactions.find(t => t._id === idStr);
        if (!transaction) return;

        try {
            const res = await fetch(`/api/transactions/${idStr}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'approved',
                    approvedBy: 'Current User',
                    approvedAt: new Date().toISOString(),
                }),
            });
            if (!res.ok) throw new Error('failed to update transaction');

            // reload list to reflect latest state
            await loadPendingTransactions();

            // Add approval decision to history view
            const newDecision: ApprovalDecision = {
                id: Date.now().toString(),
                transactionId: idStr,
                approver: 'Current User', // Replace with actual user
                timestamp: new Date().toISOString(),
                rationale: 'Approved after review',
                outcome: 'approved'
            };
            setApprovalDecisions(prev => [...prev, newDecision]);

            alert('Transaction approved successfully!');
        } catch (error) {
            console.error('Error approving transaction:', error);
            alert('Error approving transaction. Please try again.');
        }
    };

    const handleReject = async (transactionId: string | number) => {
        const idStr = String(transactionId);
        const transaction = pendingTransactions.find(t => t._id === idStr);
        if (!transaction) return;

        const rationale = prompt('Please provide reason for rejection:');
        if (!rationale) return;

        try {
            const res = await fetch(`/api/transactions/${idStr}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'rejected',
                    rejectedBy: 'Current User',
                    rejectedAt: new Date().toISOString(),
                    rejectionReason: rationale,
                }),
            });
            if (!res.ok) throw new Error('failed to update transaction');

            // reload list to reflect latest state
            await loadPendingTransactions();

            // Add approval decision
            const newDecision: ApprovalDecision = {
                id: Date.now().toString(),
                transactionId: idStr,
                approver: 'Current User', // Replace with actual user
                timestamp: new Date().toISOString(),
                rationale,
                outcome: 'rejected'
            };
            setApprovalDecisions(prev => [...prev, newDecision]);

            alert('Transaction rejected successfully!');
        } catch (error) {
            console.error('Error rejecting transaction:', error);
            alert('Error rejecting transaction. Please try again.');
        }
    };

    if (loading) {
        return <div className="approvals-loading">Loading pending transactions...</div>;
    }

    const pendingOnly = pendingTransactions.filter(t => t.status === 'pending');

    return (
        <div className="approvals-container">
            <div className="approvals-header">
                <h2>Pending Approvals</h2>
                <div className="approvals-stats">
                    <span className="stat-item">
                        <span className="stat-number">{pendingOnly.length}</span>
                        <span className="stat-label">Pending</span>
                    </span>
                </div>
            </div>

            {pendingOnly.length === 0 ? (
                <div className="no-pending">
                    <div className="no-pending-icon">✅</div>
                    <h3>No Pending Approvals</h3>
                    <p>All transactions have been processed.</p>
                </div>
            ) : (
                <div className="pending-transactions">
                    {pendingOnly.map((transaction) => (
                        <div key={transaction._id} className="transaction-card">
                            <div className="transaction-header">
                                <div className="transaction-amount">{transaction.amount}</div>
                                <div className="transaction-status pending">Pending</div>
                            </div>
                            
                            <div className="transaction-details">
                                <div className="detail-row">
                                    <span className="detail-label">Company:</span>
                                    <span className="detail-value">{transaction.company || 'Unknown'}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Requested by:</span>
                                    <span className="detail-value">{transaction.requestedBy || 'N/A'}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Reason:</span>
                                    <span className="detail-value">{transaction.reason}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Requested:</span>
                                    <span className="detail-value">{transaction.timestamp}</span>
                                </div>
                            </div>

                            <div className="transaction-actions">
                                <button 
                                    className="action-btn approve-btn"
                                    onClick={() => handleApprove(transaction._id)}
                                >
                                    ✅ Approve
                                </button>
                                <button 
                                    className="action-btn reject-btn"
                                    onClick={() => handleReject(transaction._id)}
                                >
                                    ❌ Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Decision History */}
            {approvalDecisions.length > 0 && (
                <div className="decision-history">
                    <h3>Decision History</h3>
                    <div className="decisions-list">
                        {approvalDecisions.map((decision) => (
                            <div key={decision.id} className="decision-card">
                                <div className="decision-header">
                                    <span className={`decision-outcome ${decision.outcome}`}>
                                        {decision.outcome === 'approved' ? '✅ Approved' : '❌ Rejected'}
                                    </span>
                                    <span className="decision-timestamp">{decision.timestamp}</span>
                                </div>
                                <div className="decision-details">
                                    <div className="decision-approver">By: {decision.approver}</div>
                                    <div className="decision-rationale">Reason: {decision.rationale}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Approvals;
