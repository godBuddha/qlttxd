import { Component } from 'react';
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div className="panel" style={{margin:'40px auto',maxWidth:600,textAlign:'center'}}><h2 style={{color:'var(--color-error)'}}>Đã xảy ra lỗi</h2><p style={{color:'var(--text-secondary)'}}>{this.state.error.message}</p><button onClick={() => { this.setState({error:null}); window.location.reload(); }}>Tải lại trang</button></div>;
    return this.props.children;
  }
}
