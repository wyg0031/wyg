let currentUser = null;
let token = null;
let currentPage = 'dashboard';
let currentMembers = [];
let currentActivities = [];
let currentVolunteers = [];

document.addEventListener('DOMContentLoaded', function() {
  setupLoginTabs();
  setupSidebarNavigation();
  checkAuth();
});

function setupLoginTabs() {
  const tabs = document.querySelectorAll('.login-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      const tabType = this.dataset.tab;
      document.getElementById('loginForm').style.display = tabType === 'login' ? 'block' : 'none';
      document.getElementById('registerForm').style.display = tabType === 'register' ? 'block' : 'none';
    });
  });
}

function setupSidebarNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', function() {
      menuItems.forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      navigateTo(this.dataset.page);
    });
  });
}

function checkAuth() {
  token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  if (token && user) {
    currentUser = JSON.parse(user);
    showMainPage();
  } else {
    showLoginPage();
  }
}

function showLoginPage() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('mainPage').style.display = 'none';
}

function showMainPage() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('mainPage').style.display = 'flex';

  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '超级管理员' : '普通用户';

  if (currentUser.role === 'admin') {
    document.getElementById('adminActions').style.display = 'block';
    document.getElementById('userActions').style.display = 'none';
    loadUsers();
    loadCodes();
  } else {
    document.getElementById('adminActions').style.display = 'none';
    document.getElementById('userActions').style.display = 'block';
    document.getElementById('currentUserCard').textContent = currentUser.id_card;
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserRole').textContent = currentUser.role === 'admin' ? '超级管理员' : '普通用户';
  }

  loadDashboardStats();
}

function navigateTo(page) {
  currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById(page + 'Page').style.display = 'block';

  switch(page) {
    case 'dashboard':
      loadDashboardStats();
      break;
    case 'members':
      loadMembers();
      break;
    case 'activities':
      loadActivities();
      break;
    case 'volunteers':
      loadVolunteers();
      break;
    case 'accounts':
      if (currentUser.role === 'admin') {
        loadUsers();
        loadCodes();
      }
      break;
  }
}

async function login() {
  const idCard = document.getElementById('loginIdCard').value;
  const password = document.getElementById('loginPassword').value;

  if (!idCard || !password) {
    showAlert('请填写完整信息', 'error');
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_card: idCard, password })
    });

    const data = await response.json();

    if (response.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(currentUser));
      showAlert('登录成功', 'success');
      showMainPage();
    } else {
      showAlert(data.error || '登录失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

async function register() {
  const idCard = document.getElementById('registerIdCard').value;
  const name = document.getElementById('registerName').value;
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;
  const code = document.getElementById('registerCode').value;

  if (!idCard || !name || !password || !code) {
    showAlert('请填写完整信息', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showAlert('两次密码输入不一致', 'error');
    return;
  }

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_card: idCard, name, password, registration_code: code })
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('注册成功，请登录', 'success');
      document.querySelector('.login-tab[data-tab="login"]').click();
    } else {
      showAlert(data.error || '注册失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  token = null;
  currentUser = null;
  showLoginPage();
  showAlert('已退出登录', 'success');
}

async function loadDashboardStats() {
  try {
    const response = await fetch('/api/dashboard/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById('memberCount').textContent = data.memberCount;
      document.getElementById('activityCount').textContent = data.activityCount;
      document.getElementById('volunteerCount').textContent = data.volunteerCount;
    }
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
}

async function loadMembers() {
  try {
    const response = await fetch('/api/members', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      currentMembers = data;
      renderMembersTable(data);
    }
  } catch (error) {
    showAlert('加载团员信息失败', 'error');
  }
}

function renderMembersTable(members) {
  const tbody = document.getElementById('membersTableBody');

  if (members.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <div>暂无数据</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = members.map(member => `
    <tr>
      <td>${member.name}</td>
      <td>${member.gender}</td>
      <td>${member.id_card}</td>
      <td>${member.birth_date}</td>
      <td>${member.ethnicity}</td>
      <td>${member.phone}</td>
      <td>${member.political_status}</td>
      <td>${member.member_number}</td>
      <td>${member.join_date}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteMember(${member.id})">删除</button>
      </td>
    </tr>
  `).join('');
}

async function searchMembers() {
  const search = document.getElementById('memberSearch').value;

  try {
    const response = await fetch(`/api/members?search=${encodeURIComponent(search)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      renderMembersTable(data);
    }
  } catch (error) {
    showAlert('搜索失败', 'error');
  }
}

function showAddMemberModal() {
  document.getElementById('modalTitle').textContent = '添加团员';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label>姓名</label>
      <input type="text" id="memberName" placeholder="请输入姓名">
    </div>
    <div class="form-group">
      <label>性别</label>
      <select id="memberGender" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;">
        <option value="男">男</option>
        <option value="女">女</option>
      </select>
    </div>
    <div class="form-group">
      <label>身份证号</label>
      <input type="text" id="memberIdCard" placeholder="请输入身份证号">
    </div>
    <div class="form-group">
      <label>出生年月</label>
      <input type="text" id="memberBirthDate" placeholder="例如：2002年3月30日">
    </div>
    <div class="form-group">
      <label>民族</label>
      <input type="text" id="memberEthnicity" placeholder="请输入民族">
    </div>
    <div class="form-group">
      <label>手机号码</label>
      <input type="text" id="memberPhone" placeholder="请输入手机号码">
    </div>
    <div class="form-group">
      <label>政治面貌</label>
      <input type="text" id="memberPoliticalStatus" placeholder="请输入政治面貌">
    </div>
    <div class="form-group">
      <label>团员发展编号</label>
      <input type="text" id="memberNumber" placeholder="请输入团员编号">
    </div>
    <div class="form-group">
      <label>入团时间</label>
      <input type="text" id="memberJoinDate" placeholder="例如：2015年3月">
    </div>
  `;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="addMember()">确定</button>
  `;
  document.getElementById('modal').classList.add('active');
}

async function addMember() {
  const member = {
    name: document.getElementById('memberName').value,
    gender: document.getElementById('memberGender').value,
    id_card: document.getElementById('memberIdCard').value,
    birth_date: document.getElementById('memberBirthDate').value,
    ethnicity: document.getElementById('memberEthnicity').value,
    phone: document.getElementById('memberPhone').value,
    political_status: document.getElementById('memberPoliticalStatus').value,
    member_number: document.getElementById('memberNumber').value,
    join_date: document.getElementById('memberJoinDate').value
  };

  try {
    const response = await fetch('/api/members', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(member)
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('添加成功', 'success');
      closeModal();
      loadMembers();
    } else {
      showAlert(data.error || '添加失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

async function deleteMember(id) {
  if (!confirm('确定要删除该团员信息吗？')) return;

  try {
    const response = await fetch(`/api/members/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      showAlert('删除成功', 'success');
      loadMembers();
    } else {
      showAlert('删除失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

function exportMembers() {
  const ids = currentMembers.map(m => m.id).join(',');
  window.location.href = `/api/export/members?ids=${ids}&token=${token}`;
}

async function loadActivities() {
  try {
    const response = await fetch('/api/activities', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      currentActivities = data;
      renderActivitiesTable(data);
    }
  } catch (error) {
    showAlert('加载活动信息失败', 'error');
  }
}

function renderActivitiesTable(activities) {
  const tbody = document.getElementById('activitiesTableBody');

  if (activities.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div>暂无数据</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = activities.map(activity => `
    <tr>
      <td>${activity.name}</td>
      <td>${activity.location}</td>
      <td>${activity.start_time}</td>
      <td>${activity.end_time}</td>
      <td>${activity.duration}</td>
      <td>${activity.participant_count || 0}</td>
      <td>${activity.remarks || '-'}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="showActivityParticipants(${activity.id})">查看人员</button>
        <button class="btn btn-danger btn-sm" onclick="deleteActivity(${activity.id})">删除</button>
      </td>
    </tr>
  `).join('');
}

async function searchActivities() {
  const search = document.getElementById('activitySearch').value;

  try {
    const response = await fetch(`/api/activities?search=${encodeURIComponent(search)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      renderActivitiesTable(data);
    }
  } catch (error) {
    showAlert('搜索失败', 'error');
  }
}

function showAddActivityModal() {
  document.getElementById('modalTitle').textContent = '添加活动';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label>活动名称</label>
      <input type="text" id="activityName" placeholder="请输入活动名称">
    </div>
    <div class="form-group">
      <label>活动地点</label>
      <input type="text" id="activityLocation" placeholder="请输入活动地点">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>开始时间</label>
        <input type="datetime-local" id="activityStartTime">
      </div>
      <div class="form-group">
        <label>结束时间</label>
        <input type="datetime-local" id="activityEndTime">
      </div>
    </div>
    <div class="form-group">
      <label>活动时长（小时）</label>
      <input type="text" id="activityDuration" placeholder="自动计算" readonly>
    </div>
    <div class="form-group">
      <label>备注</label>
      <textarea id="activityRemarks" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; min-height: 80px;" placeholder="请输入备注"></textarea>
    </div>
    <div class="form-group">
      <label>参与人员（每行一个姓名）</label>
      <textarea id="activityParticipants" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; min-height: 100px;" placeholder="请输入参与人员姓名，每行一个"></textarea>
    </div>
  `;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="addActivity()">确定</button>
  `;
  document.getElementById('modal').classList.add('active');

  document.getElementById('activityStartTime').addEventListener('change', calculateDuration);
  document.getElementById('activityEndTime').addEventListener('change', calculateDuration);
}

function calculateDuration() {
  const startTime = document.getElementById('activityStartTime').value;
  const endTime = document.getElementById('activityEndTime').value;

  if (startTime && endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = (end - start) / (1000 * 60 * 60);
    document.getElementById('activityDuration').value = diff.toFixed(1);
  }
}

async function addActivity() {
  const participantsText = document.getElementById('activityParticipants').value;
  const participants = participantsText.split('\n').filter(p => p.trim());

  const activity = {
    name: document.getElementById('activityName').value,
    location: document.getElementById('activityLocation').value,
    start_time: document.getElementById('activityStartTime').value.replace('T', ' '),
    end_time: document.getElementById('activityEndTime').value.replace('T', ' '),
    duration: parseFloat(document.getElementById('activityDuration').value),
    remarks: document.getElementById('activityRemarks').value,
    participants: participants
  };

  try {
    const response = await fetch('/api/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(activity)
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('添加成功', 'success');
      closeModal();
      loadActivities();
    } else {
      showAlert(data.error || '添加失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

async function showActivityParticipants(activityId) {
  try {
    const response = await fetch(`/api/activities/${activityId}/participants`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      const activity = currentActivities.find(a => a.id === activityId);
      document.getElementById('modalTitle').textContent = '活动参与人员';
      document.getElementById('modalBody').innerHTML = `
        <p><strong>活动名称：</strong>${activity.name}</p>
        <p><strong>参与人数：</strong>${data.length}</p>
        <div style="margin-top: 20px;">
          ${data.map(p => `<div style="padding: 10px; background: #f8f9fa; margin-bottom: 5px; border-radius: 5px;">${p.name}</div>`).join('')}
        </div>
      `;
      document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
        <button class="btn btn-primary" onclick="exportActivityParticipants(${activityId})">导出</button>
      `;
      document.getElementById('modal').classList.add('active');
    }
  } catch (error) {
    showAlert('加载参与人员失败', 'error');
  }
}

function exportActivityParticipants(activityId) {
  window.location.href = `/api/export/activity-participants?activityId=${activityId}&token=${token}`;
}

async function deleteActivity(id) {
  if (!confirm('确定要删除该活动吗？')) return;

  try {
    const response = await fetch(`/api/activities/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      showAlert('删除成功', 'success');
      loadActivities();
    } else {
      showAlert('删除失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

async function loadVolunteers() {
  try {
    const response = await fetch('/api/volunteers', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      currentVolunteers = data;
      renderVolunteersTable(data);
    }
  } catch (error) {
    showAlert('加载志愿者信息失败', 'error');
  }
}

function renderVolunteersTable(volunteers) {
  const tbody = document.getElementById('volunteersTableBody');

  if (volunteers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div>暂无数据</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = volunteers.map(volunteer => `
    <tr>
      <td>${volunteer.name}</td>
      <td>${volunteer.gender}</td>
      <td>${volunteer.id_card}</td>
      <td>${volunteer.birth_date}</td>
      <td>${volunteer.ethnicity}</td>
      <td>${volunteer.phone}</td>
      <td>${volunteer.address || '-'}</td>
      <td>${volunteer.volunteer_hours || 0}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteVolunteer(${volunteer.id})">删除</button>
      </td>
    </tr>
  `).join('');
}

async function searchVolunteers() {
  const search = document.getElementById('volunteerSearch').value;

  try {
    const response = await fetch(`/api/volunteers?search=${encodeURIComponent(search)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      renderVolunteersTable(data);
    }
  } catch (error) {
    showAlert('搜索失败', 'error');
  }
}

async function deleteVolunteer(id) {
  if (!confirm('确定要删除该志愿者信息吗？')) return;

  try {
    const response = await fetch(`/api/volunteers/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      showAlert('删除成功', 'success');
      loadVolunteers();
    } else {
      showAlert('删除失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

async function globalSearch() {
  const query = document.getElementById('globalSearch').value;

  if (!query) {
    showAlert('请输入搜索关键词', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      renderSearchResults(data, query);
    }
  } catch (error) {
    showAlert('搜索失败', 'error');
  }
}

function renderSearchResults(data, query) {
  const container = document.getElementById('searchResults');

  let html = '';

  if (data.members.length > 0) {
    html += `
      <div class="search-section">
        <h3>团员信息 (${data.members.length})</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>身份证号</th>
                <th>团员编号</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${data.members.map(m => `
                <tr>
                  <td>${m.name}</td>
                  <td>${m.id_card}</td>
                  <td>${m.member_number}</td>
                  <td>
                    <button class="btn btn-primary btn-sm" onclick="exportToWord('member', ${m.id})">导出</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (data.activities.length > 0) {
    html += `
      <div class="search-section">
        <h3>活动记录 (${data.activities.length})</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>活动名称</th>
                <th>地点</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${data.activities.map(a => `
                <tr>
                  <td>${a.name}</td>
                  <td>${a.location}</td>
                  <td>${a.start_time}</td>
                  <td>
                    <button class="btn btn-primary btn-sm" onclick="exportActivityParticipants(${a.id})">导出人员</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (data.volunteers.length > 0) {
    html += `
      <div class="search-section">
        <h3>志愿者信息 (${data.volunteers.length})</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>身份证号</th>
                <th>志愿时长</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${data.volunteers.map(v => `
                <tr>
                  <td>${v.name}</td>
                  <td>${v.id_card}</td>
                  <td>${v.volunteer_hours || 0}</td>
                  <td>
                    <button class="btn btn-primary btn-sm" onclick="exportToWord('volunteer', ${v.id})">导出</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (!html) {
    html = '<div class="empty-state"><h3>未找到相关结果</h3><p>请尝试其他关键词</p></div>';
  }

  container.innerHTML = html;
}

function exportToWord(type, id) {
  window.location.href = `/api/export/word?type=${type}&id=${id}&token=${token}`;
}

async function loadUsers() {
  try {
    const response = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      renderUsersTable(data);
    }
  } catch (error) {
    showAlert('加载用户列表失败', 'error');
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${user.id_card}</td>
      <td>${user.name}</td>
      <td>${user.role === 'admin' ? '超级管理员' : '普通用户'}</td>
      <td>${new Date(user.created_at).toLocaleDateString()}</td>
      <td>
        ${user.id !== currentUser.id ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">删除</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function loadCodes() {
  try {
    const response = await fetch('/api/registration-codes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      renderCodesTable(data);
    }
  } catch (error) {
    showAlert('加载注册码失败', 'error');
  }
}

function renderCodesTable(codes) {
  const tbody = document.getElementById('codesTableBody');
  tbody.innerHTML = codes.map(code => `
    <tr>
      <td>${code.code}</td>
      <td>${code.used ? '已使用' : '未使用'}</td>
      <td>${new Date(code.created_at).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteCode(${code.id})">删除</button>
      </td>
    </tr>
  `).join('');
}

function showAddUserModal() {
  document.getElementById('modalTitle').textContent = '添加用户';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label>身份证号</label>
      <input type="text" id="newUserIdCard" placeholder="请输入身份证号">
    </div>
    <div class="form-group">
      <label>姓名</label>
      <input type="text" id="newUserName" placeholder="请输入姓名">
    </div>
    <div class="form-group">
      <label>密码</label>
      <input type="password" id="newUserPassword" placeholder="请输入密码">
    </div>
    <div class="form-group">
      <label>角色</label>
      <select id="newUserRole" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;">
        <option value="user">普通用户</option>
        <option value="admin">超级管理员</option>
      </select>
    </div>
  `;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="addUser()">确定</button>
  `;
  document.getElementById('modal').classList.add('active');
}

async function addUser() {
  const user = {
    id_card: document.getElementById('newUserIdCard').value,
    name: document.getElementById('newUserName').value,
    password: document.getElementById('newUserPassword').value,
    role: document.getElementById('newUserRole').value
  };

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(user)
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('添加成功', 'success');
      closeModal();
      loadUsers();
    } else {
      showAlert(data.error || '添加失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

async function deleteUser(id) {
  if (!confirm('确定要删除该用户吗？')) return;

  try {
    const response = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      showAlert('删除成功', 'success');
      loadUsers();
    } else {
      showAlert('删除失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

function showAddCodeModal() {
  document.getElementById('modalTitle').textContent = '添加注册码';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label>注册码</label>
      <input type="text" id="newCode" placeholder="请输入注册码">
    </div>
  `;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="addCode()">确定</button>
  `;
  document.getElementById('modal').classList.add('active');
}

async function addCode() {
  const code = document.getElementById('newCode').value;

  try {
    const response = await fetch('/api/registration-codes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ code })
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('添加成功', 'success');
      closeModal();
      loadCodes();
    } else {
      showAlert(data.error || '添加失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

async function deleteCode(id) {
  if (!confirm('确定要删除该注册码吗？')) return;

  try {
    const response = await fetch(`/api/registration-codes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      showAlert('删除成功', 'success');
      loadCodes();
    } else {
      showAlert('删除失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

function showEditUserModal() {
  document.getElementById('modalTitle').textContent = '修改个人信息';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label>姓名</label>
      <input type="text" id="editUserName" value="${currentUser.name}">
    </div>
    <div class="form-group">
      <label>新密码（留空则不修改）</label>
      <input type="password" id="editUserPassword" placeholder="请输入新密码">
    </div>
  `;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="editUser()">确定</button>
  `;
  document.getElementById('modal').classList.add('active');
}

async function editUser() {
  const name = document.getElementById('editUserName').value;
  const password = document.getElementById('editUserPassword').value;

  try {
    const response = await fetch(`/api/users/${currentUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, password })
    });

    const data = await response.json();

    if (response.ok) {
      currentUser.name = name;
      localStorage.setItem('user', JSON.stringify(currentUser));
      document.getElementById('userName').textContent = name;
      document.getElementById('currentUserName').textContent = name;
      showAlert('修改成功', 'success');
      closeModal();
    } else {
      showAlert(data.error || '修改失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

function showBatchUploadModal(type) {
  const title = type === 'members' ? '批量上传团员信息' : '批量上传志愿者信息';
  const template = type === 'members' 
    ? '姓名、性别、身份证号、出生年月、民族、手机号码、政治面貌、团员发展编号、入团时间'
    : '姓名、性别、身份证号、出生年月、民族、手机号码、地址、志愿时长';

  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label>上传Excel文件</label>
      <input type="file" id="batchFile" accept=".xlsx,.xls" style="width: 100%; padding: 10px;">
    </div>
    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
      <p style="margin-bottom: 10px;"><strong>表格格式：</strong></p>
      <p>${template}</p>
      <p style="margin-top: 10px; font-size: 12px; color: #6c757d;">注意：出生年月格式如 20020330 识别为 2002年3月30日</p>
    </div>
  `;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="batchUpload('${type}')">上传</button>
  `;
  document.getElementById('modal').classList.add('active');
}

async function batchUpload(type) {
  const fileInput = document.getElementById('batchFile');
  const file = fileInput.files[0];

  if (!file) {
    showAlert('请选择文件', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const url = type === 'members' ? '/api/members/batch' : '/api/volunteers/batch';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      showAlert(data.message, 'success');
      closeModal();
      if (type === 'members') {
        loadMembers();
      } else {
        loadVolunteers();
      }
    } else {
      showAlert(data.error || '上传失败', 'error');
    }
  } catch (error) {
    showAlert('网络错误，请重试', 'error');
  }
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

function showAlert(message, type) {
  const alert = document.getElementById('alert');
  alert.textContent = message;
  alert.className = `alert alert-${type} active`;

  setTimeout(() => {
    alert.classList.remove('active');
  }, 3000);
}

document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) {
    closeModal();
  }
});
