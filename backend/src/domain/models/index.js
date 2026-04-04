const sequelize = require('../../config/database');
const Company = require('./Company');
const Role = require('./Role');
const User = require('./User');
const Note = require('./Note');
const Task = require('./Task');
const Subcontractor = require('./Subcontractor');
const Client = require('./Client');
const Category = require('./Category');
const Subcategory = require('./Subcategory');
const Question = require('./Question');
const Answer = require('./Answer');
const Inquiry = require('./Inquiry');
const InquiryAnswer = require('./InquiryAnswer');
const Project = require('./Project');
const ProjectUser = require('./ProjectUser');
const ProjectSubcontractor = require('./ProjectSubcontractor');
const ProjectAnswer = require('./ProjectAnswer');
const ProjectImage = require('./ProjectImage');
const ProjectStage = require('./ProjectStage');
const ProjectStageImage = require('./ProjectStageImage');
const SupportTicket = require('./SupportTicket');
const SupportResponse = require('./SupportResponse');
const ApiKey = require('./ApiKey');
const EmailAccount = require('./EmailAccount');
const Email = require('./Email');
const Attachment = require('./Attachment');
const ProjectFolder = require('./ProjectFolder');
const ProjectFile = require('./ProjectFile');

// Associations

// 8. API Keys
Company.hasMany(ApiKey, { foreignKey: 'company_id', as: 'api_keys' });
ApiKey.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

User.hasMany(ApiKey, { foreignKey: 'created_by_id', as: 'created_api_keys' });
ApiKey.belongsTo(User, { foreignKey: 'created_by_id', as: 'created_by' });

// 1. Core Models
Company.hasMany(User, { foreignKey: 'company_id', as: 'users' });
User.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

User.hasMany(User, { foreignKey: 'manager_id', as: 'subordinates' });
User.belongsTo(User, { foreignKey: 'manager_id', as: 'manager' });

// 2. Client & Project
Subcontractor.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Client.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Client.hasMany(Project, { foreignKey: 'client_id', as: 'projects' });
Project.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });

User.hasMany(Project, { foreignKey: 'created_by', as: 'created_projects' });
Project.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Project.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Project.belongsTo(Subcategory, { foreignKey: 'subcategory_id', as: 'subcategory' });

// N:M Project assignments
Project.hasMany(ProjectUser, { foreignKey: 'project_id', as: 'assigned_personnel' });
ProjectUser.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
User.hasMany(ProjectUser, { foreignKey: 'user_id', as: 'project_roles' });
ProjectUser.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Project.hasMany(ProjectSubcontractor, { foreignKey: 'project_id', as: 'assigned_subcontractors' });
ProjectSubcontractor.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Subcontractor.hasMany(ProjectSubcontractor, { foreignKey: 'subcontractor_id', as: 'project_associations' });
ProjectSubcontractor.belongsTo(Subcontractor, { foreignKey: 'subcontractor_id', as: 'subcontractor' });

// Project dynamic data
Project.hasMany(ProjectAnswer, { foreignKey: 'project_id', as: 'answers' });
ProjectAnswer.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
ProjectAnswer.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });
ProjectAnswer.belongsTo(Answer, { foreignKey: 'answer_id', as: 'answer' });

Project.hasMany(ProjectImage, { foreignKey: 'project_id', as: 'images' });
ProjectImage.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
ProjectImage.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

// 3. Project Stages (NEW)
Project.hasMany(ProjectStage, { foreignKey: 'project_id', as: 'stages' });
ProjectStage.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

ProjectStage.hasMany(ProjectStageImage, { foreignKey: 'project_stage_id', as: 'images' });
ProjectStageImage.belongsTo(ProjectStage, { foreignKey: 'project_stage_id', as: 'stage' });

ProjectStage.belongsTo(User, { foreignKey: 'assigned_to_id', as: 'assignee' });
ProjectStage.belongsTo(User, { foreignKey: 'created_by_id', as: 'creator' });

// 4. Tasks (General)
Task.belongsTo(User, { foreignKey: 'assigned_to_id', as: 'assignee' });
Task.belongsTo(User, { foreignKey: 'created_by_id', as: 'creator' });


Task.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Project.hasMany(Task, { foreignKey: 'project_id', as: 'tasks' });

// 5. Notes
Note.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Note, { foreignKey: 'user_id', as: 'notes' });

Note.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Project.hasMany(Note, { foreignKey: 'project_id', as: 'notes' });

// 6. Decision Tree & Inquiries
Category.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Category.hasMany(Subcategory, { foreignKey: 'category_id', as: 'subcategories' });
Subcategory.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Subcategory.hasMany(Question, { foreignKey: 'subcategory_id', as: 'questions' });
Question.belongsTo(Subcategory, { foreignKey: 'subcategory_id', as: 'subcategory' });

Question.hasMany(Answer, { foreignKey: 'question_id', as: 'answers' });
Answer.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });
Answer.belongsTo(Question, { foreignKey: 'next_question_id', as: 'next_question' });

Inquiry.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Inquiry.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
Inquiry.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Inquiry.belongsTo(Subcategory, { foreignKey: 'subcategory_id', as: 'subcategory' });
Inquiry.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Inquiry.hasMany(InquiryAnswer, { foreignKey: 'inquiry_id', as: 'answers' });
InquiryAnswer.belongsTo(Inquiry, { foreignKey: 'inquiry_id', as: 'inquiry' });
InquiryAnswer.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });
InquiryAnswer.belongsTo(Answer, { foreignKey: 'answer_id', as: 'answer' });

// 7. Support
SupportTicket.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
SupportTicket.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
SupportTicket.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
SupportTicket.belongsTo(User, { foreignKey: 'assigned_to_id', as: 'assignee' });

SupportTicket.hasMany(SupportResponse, { foreignKey: 'ticket_id', as: 'responses' });
SupportResponse.belongsTo(SupportTicket, { foreignKey: 'ticket_id', as: 'ticket' });
SupportResponse.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 8. Email Accounts
EmailAccount.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

User.hasMany(EmailAccount, { foreignKey: 'user_id', as: 'assigned_email_accounts' });
EmailAccount.belongsTo(User, { foreignKey: 'user_id', as: 'assigned_user' });

// 9. Emails & Attachments
Email.hasMany(Attachment, { foreignKey: 'email_id', as: 'attachments', onDelete: 'CASCADE' });
Attachment.belongsTo(Email, { foreignKey: 'email_id', as: 'email' });

Inquiry.hasMany(Attachment, { foreignKey: 'inquiry_id', as: 'attachments', onDelete: 'CASCADE' });
Attachment.belongsTo(Inquiry, { foreignKey: 'inquiry_id', as: 'inquiry' });

Note.hasMany(Attachment, { foreignKey: 'note_id', as: 'attachments', onDelete: 'CASCADE' });
Attachment.belongsTo(Note, { foreignKey: 'note_id', as: 'note' });

Task.hasMany(Attachment, { foreignKey: 'task_id', as: 'attachments', onDelete: 'CASCADE' });
Attachment.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });

Company.hasMany(Email, { foreignKey: 'company_id', as: 'emails' });
Email.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// 10. Project Folders
Project.hasMany(ProjectFolder, { foreignKey: 'project_id', as: 'folders', onDelete: 'CASCADE' });
ProjectFolder.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Project.hasMany(ProjectFile, { foreignKey: 'project_id', as: 'files', onDelete: 'CASCADE' });
ProjectFile.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

ProjectFolder.belongsTo(User, { foreignKey: 'created_by_id', as: 'creator' });
ProjectFile.belongsTo(User, { foreignKey: 'created_by_id', as: 'creator' });
ProjectFile.belongsTo(ProjectFolder, { foreignKey: 'folder_id', as: 'folder' });
ProjectFolder.hasMany(ProjectFile, { foreignKey: 'folder_id', as: 'files', onDelete: 'CASCADE' });

module.exports = {
    sequelize,
    Company,
    Role,
    User,
    Note,
    Task,
    Subcontractor,
    Client,
    Category,
    Subcategory,
    Question,
    Answer,
    Inquiry,
    InquiryAnswer,
    Project,
    ProjectUser,
    ProjectSubcontractor,
    ProjectAnswer,
    ProjectImage,
    ProjectStage,
    ProjectStageImage,
    SupportTicket,
    SupportResponse,
    ApiKey,
    EmailAccount,
    Email,
    Attachment,
    ProjectFolder,
    ProjectFile
};
