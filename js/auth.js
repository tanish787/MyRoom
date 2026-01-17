class AuthManager {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.userId = localStorage.getItem('userId');
  }

  async signup(fullName, email, phone, password) {
    try {
      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phone, password }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userId', data.userId);
        this.token = data.token;
        this.userId = data.userId;
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message };
    } catch (error) {
      return { success: false, message: 'Network error' };
    }
  }

  async login(email, password) {
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userId', data.userId);
        this.token = data.token;
        this.userId = data.userId;
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message };
    } catch (error) {
      return { success: false, message: 'Network error' };
    }
  }

  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    this.token = null;
    this.userId = null;
  }

  isLoggedIn() {
    return !!this.token;
  }

  async getUserProfile() {
    if (!this.token) return null;

    try {
      const response = await fetch('http://localhost:5000/api/user/profile', {
        headers: { 'Authorization': `Bearer ${this.token}` },
      });

      return response.ok ? response.json() : null;
    } catch (error) {
      return null;
    }
  }

  async saveRoom(roomName, roomData) {
    if (!this.token) return { success: false, message: 'Not logged in' };

    try {
      const response = await fetch('http://localhost:5000/api/user/save-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({ roomName, roomData }),
      });

      const data = await response.json();
      return { success: response.ok, message: data.message, savedRooms: data.savedRooms };
    } catch (error) {
      return { success: false, message: 'Network error' };
    }
  }

  async uploadItem(itemName, itemPrice, itemDescription, imageFile) {
    if (!this.token) return { success: false, message: 'Not logged in' };

    try {
      const formData = new FormData();
      formData.append('itemName', itemName);
      formData.append('itemPrice', itemPrice);
      formData.append('itemDescription', itemDescription);
      formData.append('image', imageFile);

      const response = await fetch('http://localhost:5000/api/user/upload-item', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
        body: formData,
      });

      const data = await response.json();
      return { success: response.ok, message: data.message, listedItems: data.listedItems };
    } catch (error) {
      return { success: false, message: 'Network error' };
    }
  }
}

const authManager = new AuthManager();