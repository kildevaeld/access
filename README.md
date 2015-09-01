# access
Nodejs acl


```javascript
'use strict';
// In memory store
var acl = new ACL();

class Blog {
  get acl_id () {
    return 'blog:1'
  }
}

class User {
  get acl_id () {
    return 'user:1'
  }
}

let user = new User();
let blog = new Blog();

acl.role('guest')
.role('member', 'guest') // member inherits guest
.allow('guest', 'blogs','view') // Guests can view blogs
.allow('member','blogs', 'comment') // But only member can comment
.allow(user, blog, 'admin') // only user:1 can administrate blog:1

acl.can('member','view','blogs') // true
acl.can('guest', 'comment','blogs') // false
acl.can(user, 'admin', blog) // true


```

