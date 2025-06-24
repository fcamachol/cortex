import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const transactions = [
  {
    id: '1',
    description: 'Payment from Carlos Mendez',
    amount: 2500.00,
    type: 'income',
    date: 'Today',
    category: 'Client Payment',
  },
  {
    id: '2',
    description: 'Office supplies',
    amount: -150.00,
    type: 'expense',
    date: 'Yesterday',
    category: 'Office',
  },
  {
    id: '3',
    description: 'Consultation fee',
    amount: 800.00,
    type: 'income',
    date: 'Dec 22',
    category: 'Services',
  },
  {
    id: '4',
    description: 'Software subscription',
    amount: -99.00,
    type: 'expense',
    date: 'Dec 20',
    category: 'Technology',
  },
];

const upcomingBills = [
  {
    id: '1',
    title: 'Internet Service',
    amount: 89.99,
    dueDate: 'Dec 28',
    status: 'pending',
  },
  {
    id: '2',
    title: 'Office Rent',
    amount: 1200.00,
    dueDate: 'Jan 1',
    status: 'pending',
  },
];

export default function FinanceScreen() {
  const renderTransaction = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.transactionItem}>
      <View style={[styles.transactionIcon, { backgroundColor: item.type === 'income' ? '#e8f5e8' : '#ffeaea' }]}>
        <Ionicons 
          name={item.type === 'income' ? 'trending-up' : 'trending-down'} 
          size={20} 
          color={item.type === 'income' ? '#25D366' : '#ff4444'} 
        />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionDescription}>{item.description}</Text>
        <Text style={styles.transactionCategory}>{item.category} • {item.date}</Text>
      </View>
      <Text style={[
        styles.transactionAmount,
        { color: item.type === 'income' ? '#25D366' : '#ff4444' }
      ]}>
        {item.type === 'income' ? '+' : ''}${Math.abs(item.amount).toFixed(2)}
      </Text>
    </TouchableOpacity>
  );

  const renderBill = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.billItem}>
      <View style={styles.billInfo}>
        <Text style={styles.billTitle}>{item.title}</Text>
        <Text style={styles.billDue}>Due: {item.dueDate}</Text>
      </View>
      <Text style={styles.billAmount}>${item.amount.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Balance Overview */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>$12,450.00</Text>
        <View style={styles.balanceStats}>
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatLabel}>Income</Text>
            <Text style={[styles.balanceStatAmount, { color: '#25D366' }]}>+$3,300</Text>
          </View>
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatLabel}>Expenses</Text>
            <Text style={[styles.balanceStatAmount, { color: '#ff4444' }]}>-$249</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="add-circle" size={24} color="#25D366" />
          <Text style={styles.actionText}>Add Income</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="remove-circle" size={24} color="#ff4444" />
          <Text style={styles.actionText}>Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="card" size={24} color="#2196F3" />
          <Text style={styles.actionText}>Accounts</Text>
        </TouchableOpacity>
      </View>

      {/* Upcoming Bills */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Bills</Text>
        <FlatList
          data={upcomingBills}
          renderItem={renderBill}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  balanceCard: {
    backgroundColor: '#25D366',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceLabel: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.9,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  balanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  balanceStat: {
    alignItems: 'center',
  },
  balanceStatLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  balanceStatAmount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  billItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  billDue: {
    fontSize: 12,
    color: '#ff8800',
  },
  billAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  transactionItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});